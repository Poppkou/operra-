// ============================================================
//  РЕКЛАМА — единая обёртка над SDK площадок
//  Площадка определяется при загрузке страницы:
//    • Яндекс Игры  (/sdk.js)
//    • CrazyGames   (crazygames-sdk-v3.js)
//  Если SDK не загрузился (локальный запуск, другой хостинг,
//  сбой площадки) — рекламы нет, игра работает как обычно.
//  Все показы рекламы идут только через объект Ads.
// ============================================================
const Ads = (() => {
  const INTERSTITIAL_GAP_MS = 180000;  // межэкранная реклама — не чаще раза в 3 минуты
  const SDK_TIMEOUT_MS      = 6000;    // сколько ждём загрузки SDK
  const AD_WATCHDOG_MS      = 180000;  // страховка: если площадка не ответила, продолжаем игру

  const state = {
    adapter: null,        // активная площадка или null
    busy: false,          // сейчас показывается реклама
    playing: false,       // площадке сообщено, что геймплей идёт
    gameReady: false,     // игра загружена (для LoadingAPI / loadingStop)
    lastInterstitialAt: 0,
    onPause: () => {},    // задаётся из game.js: (on) => приостановить / возобновить игру
  };

  function loadScript(src) {
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  // Ровно один раз завершает показ рекламы, даже если SDK пришлёт два события
  function settle(onDone) {
    let called = false;
    const timer = setTimeout(() => finish(false), AD_WATCHDOG_MS);
    const finish = (...args) => {
      if (called) return;
      called = true;
      clearTimeout(timer);
      state.busy = false;
      onDone(...args);
    };
    return finish;
  }

  // ---------- Яндекс Игры ----------
  // Документация: sdk-about, sdk-adv, sdk-events, sdk-game-events
  const YandexAdapter = {
    name: 'yandex',
    sdk: null,

    async load() {
      if (!(await loadScript('/sdk.js'))) return false;
      try {
        this.sdk = await YaGames.init();
      } catch (e) {
        return false;
      }
      this.sdk.on('game_api_pause',  () => state.onPause(true));
      this.sdk.on('game_api_resume', () => state.onPause(false));
      return true;
    },

    ready() {
      this.sdk.features?.LoadingAPI?.ready();
    },

    gameplay(on) {
      const g = this.sdk.features?.GameplayAPI;
      if (on) g?.start(); else g?.stop();
    },

    interstitial(done) {
      this.sdk.adv.showFullscreenAdv({ callbacks: {
        onOpen:  () => state.onPause(true),
        onClose: () => { state.onPause(false); done(true); },
        onError: () => { state.onPause(false); done(false); },
      }});
    },

    rewarded(done) {
      let earned = false;
      this.sdk.adv.showRewardedVideo({ callbacks: {
        onOpen:     () => state.onPause(true),
        onRewarded: () => { earned = true; },
        onClose:    () => { state.onPause(false); done(earned); },
        onError:    () => { state.onPause(false); done(false); },
      }});
    },
  };

  // ---------- CrazyGames ----------
  // Документация: sdk/html5-v3/sdk, sdk/html5-v3/video-ads, sdk/game, requirements/ads
  const CrazyGamesAdapter = {
    name: 'crazygames',
    sdk: null,

    async load() {
      if (!(await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js'))) return false;
      try {
        await window.CrazyGames.SDK.init();
      } catch (e) {
        return false;
      }
      this.sdk = window.CrazyGames.SDK;
      if (this.sdk.environment === 'disabled') return false;
      this.sdk.game.loadingStart();
      return true;
    },

    ready() {
      this.sdk.game.loadingStop();
    },

    gameplay(on) {
      if (on) this.sdk.game.gameplayStart(); else this.sdk.game.gameplayStop();
    },

    interstitial(done) { this.requestAd('midgame', done); },
    rewarded(done)     { this.requestAd('rewarded', done); },

    requestAd(type, done) {
      this.sdk.ad.requestAd(type, {
        adStarted:  () => state.onPause(true),
        adFinished: () => { state.onPause(false); done(true); },
        adError:    () => { state.onPause(false); done(false); },
      });
    },
  };

  const ADAPTERS = [YandexAdapter, CrazyGamesAdapter];
  const withTimeout = p => Promise.race([p, new Promise(r => setTimeout(() => r(false), SDK_TIMEOUT_MS))]);

  return {
    // game.js задаёт, как ставить игру на паузу (внутриигровая пауза на время рекламы)
    setPauseHandler(fn) { state.onPause = fn; },

    get platform() { return state.adapter ? state.adapter.name : null; },
    get busy() { return state.busy; },

    async init() {
      for (const a of ADAPTERS) {
        if (await withTimeout(a.load())) { state.adapter = a; break; }
      }
      if (state.adapter && state.gameReady) state.adapter.ready();
    },

    // Игра загружена и готова к вводу (вызывать один раз)
    gameReady() {
      state.gameReady = true;
      if (state.adapter) state.adapter.ready();
    },

    canShowRewarded() {
      return !!state.adapter && !state.busy;
    },

    canShowInterstitial() {
      return !!state.adapter && !state.busy &&
             Date.now() - state.lastInterstitialAt >= INTERSTITIAL_GAP_MS;
    },

    // Межэкранная реклама (между экранами миссии). done() вызывается всегда.
    showInterstitial(done) {
      if (!this.canShowInterstitial()) return done();
      state.busy = true;
      state.lastInterstitialAt = Date.now();
      this.gameplay(false);
      state.adapter.interstitial(settle(() => done()));
    },

    // Награда за просмотр. done(true) — только если реклама досмотрена.
    showRewarded(done) {
      if (!this.canShowRewarded()) return done(false);
      state.busy = true;
      this.gameplay(false);
      state.adapter.rewarded(settle(earned => done(!!earned)));
    },

    // Сообщить площадке, идёт ли геймплей
    gameplay(on) {
      if (!state.adapter || state.playing === on) return;
      state.playing = on;
      try { state.adapter.gameplay(on); } catch (e) { console.warn('[ADS] gameplay', e); }
    },
  };
})();
