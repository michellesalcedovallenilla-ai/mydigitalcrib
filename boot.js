(function () {
  var ready = false;
  var lastStep = 'html parsed';
  var timeoutId;

  function getLoader() {
    return document.getElementById('stage-loader');
  }

  function setStatus(text) {
    var loader = getLoader();
    if (!loader || ready) return;

    var label = loader.querySelector('[data-loader-label]');
    if (label) label.textContent = text;
  }

  function showError(title, detail) {
    if (ready) return;

    var loader = getLoader();
    if (!loader) return;

    window.clearTimeout(timeoutId);
    loader.classList.remove('hidden');
    loader.classList.add('stage-loader--error');
    loader.setAttribute('aria-hidden', 'false');
    loader.textContent = '';

    var panel = document.createElement('div');
    panel.className = 'stage-loader-error-panel';

    var heading = document.createElement('strong');
    heading.textContent = title;

    var body = document.createElement('pre');
    body.textContent = detail || 'Unknown boot error.';

    var step = document.createElement('small');
    step.textContent = 'Last boot step: ' + lastStep;

    panel.append(heading, body, step);
    loader.append(panel);
  }

  window.StageBoot = {
    mark: function (step) {
      lastStep = step;
      setStatus(step);
    },
    ready: function () {
      if (ready) return;

      ready = true;
      window.clearTimeout(timeoutId);
      var loader = getLoader();
      if (loader) loader.classList.add('hidden');
    },
    fail: showError,
  };

  window.addEventListener('error', function (event) {
    if (ready) return;

    var source = event.filename || '';
    var relevant = !source || /(^|\/)(main|screen|boot)\.js($|\?)/.test(source) || /cdn\.jsdelivr\.net/.test(source);
    if (!relevant) return;

    showError('Error loading 3D scene', event.message || String(event.error || 'Script error'));
  });

  window.addEventListener('unhandledrejection', function (event) {
    if (ready) return;

    var reason = event.reason;
    var detail = reason && reason.stack ? reason.stack : String(reason || 'Unhandled promise rejection');
    showError('Error loading 3D scene', detail);
  });

  timeoutId = window.setTimeout(function () {
    showError('3D scene did not finish booting', 'The loader timed out before the first WebGL frame rendered.');
  }, 8000);
})();
