export const qs = (selector, parent = document) => parent.querySelector(selector);
export const qsa = (selector, parent = document) => parent.querySelectorAll(selector);

export const el = (type, className = '', textContent = '') => {
  const element = document.createElement(type);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
};

export const setText = (selector, text) => {
  const element = qs(selector);
  if (element) element.textContent = text;
};

export const addClass = (selector, className) => {
  const element = typeof selector === 'string' ? qs(selector) : selector;
  if (element) element.classList.add(className);
};

export const removeClass = (selector, className) => {
  const element = typeof selector === 'string' ? qs(selector) : selector;
  if (element) element.classList.remove(className);
};
