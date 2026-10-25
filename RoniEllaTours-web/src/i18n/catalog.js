const files = import.meta.glob('../locales/*/*.json', { eager: true, import: 'default' });
export const catalogs = {};
for (const [path, copy] of Object.entries(files)) {
  const [, language, namespace] = path.match(/locales\/([^/]+)\/([^/]+)\.json$/);
  (catalogs[language] ||= {})[namespace] = copy;
}
export const namespaces = Object.keys(catalogs.en);

export function authoredLanguage(language) {
  return namespaces.every(namespace => {
    const copy = catalogs[language]?.[namespace];
    return copy && Object.keys(catalogs.en[namespace]).every(key => typeof copy[key] === 'string' && copy[key].trim());
  });
}

export function dictionary(language, pages) {
  return Object.assign({}, ...pages.map(page => catalogs[language]?.[page] || {}));
}

export function makeTranslator(copy) {
  function translate(value, parameters = {}) {
    if (value && typeof value === 'object' && typeof value.message === 'string' && value.params) {
      return translate(value.message, value.params);
    }
    if (typeof value !== 'string') return value;
    const key = value.replace(/\s+/g, ' ').trim();
    const translated = copy[key];
    const result = translated === undefined ? value : `${value.match(/^\s*/)[0]}${translated}${value.match(/\s*$/)[0]}`;
    return result.replace(/\{([\w]+)\}/g, (match, name) => Object.hasOwn(parameters, name) ? String(translate(parameters[name])) : match);
  }
  return translate;
}
