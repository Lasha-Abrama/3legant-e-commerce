(function () {
  var rules = [
    { valid: function (value) { return Array.from(value).length >= 8; }, message: 'Use at least 8 characters.' },
    { valid: function (value) { return /[A-Z]/.test(value); }, message: 'Add an uppercase letter (A–Z).' },
    { valid: function (value) { return /[a-z]/.test(value); }, message: 'Add a lowercase letter (a–z).' },
    { valid: function (value) { return /[0-9]/.test(value); }, message: 'Add a number (0–9).' },
    { valid: function (value) { return /[\p{P}\p{S}]/u.test(value); }, message: 'Add a special character, such as !, @, or #.' },
    { valid: function (value) { return new TextEncoder().encode(value).length <= 72; }, message: 'Use no more than 72 UTF-8 bytes.' },
  ];
  function missing(value) {
    return rules.filter(function (rule) { return !rule.valid(value); }).map(function (rule) { return rule.message; });
  }
  function attach(input) {
    var list = document.createElement('ul');
    list.className = 'password-requirements';
    list.id = (input.id || input.name) + '-requirements';
    list.setAttribute('aria-live', 'polite');
    input.setAttribute('aria-describedby', list.id);
    input.setAttribute('autocomplete', 'new-password');
    input.insertAdjacentElement('afterend', list);
    function update() {
      var errors = missing(input.value);
      list.replaceChildren();
      errors.forEach(function (message) {
        var item = document.createElement('li');
        item.textContent = message;
        list.appendChild(item);
      });
      list.hidden = errors.length === 0;
      input.setCustomValidity(errors.join(' '));
      return errors.length === 0;
    }
    input.addEventListener('input', update);
    update();
    return update;
  }
  window.PasswordPolicy = { missing: missing, attach: attach };
})();
