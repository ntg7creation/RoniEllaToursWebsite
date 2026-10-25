// These messages work even when the automatic translation service is unavailable.
export const translationMessages = {
  en: {
    ready: 'Automatically translated from English. Wording may be inaccurate.',
    loading: 'Translating from English… Showing English for now.',
    unavailable: 'Translation is unavailable right now. Showing English.',
    retry: 'Try again',
    details: 'About automatic translation',
  },
  ru: {
    ready: 'Автоматический перевод с английского. Возможны неточности.',
    loading: 'Переводим с английского… Пока показана английская версия.',
    unavailable: 'Перевод сейчас недоступен. Показана английская версия.',
    retry: 'Повторить',
    details: 'Об автоматическом переводе',
  },
};
// Required provider notice: https://docs.cloud.google.com/translate/attribution
export const providerNotice = 'THIS SERVICE MAY CONTAIN TRANSLATIONS POWERED BY GOOGLE. GOOGLE DISCLAIMS ALL WARRANTIES RELATED TO THE TRANSLATIONS, EXPRESS OR IMPLIED, INCLUDING ANY WARRANTIES OF ACCURACY, RELIABILITY, AND ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.';
