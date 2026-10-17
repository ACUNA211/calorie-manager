// Flags user-facing English written straight into components. Text must come from
// src/locales/*.json through t(). Checks three places:
//   1. JSX text, e.g. <p>Loading…</p>
//   2. String literals that render as JSX children, e.g. {busy ? 'Signing in…' : 'Sign in'}
//   3. Attributes a screen reader or tooltip shows, e.g. aria-label="Install hint"

const UI_ATTRIBUTES = new Set(['aria-label', 'aria-description', 'placeholder', 'title', 'alt']);

const hasLetters = (text) => /\p{L}/u.test(text);

// True when the literal is part of a value that renders, through ?: or ||/&&, as JSX children.
function rendersAsChild(node) {
  let current = node;
  while (
    current.parent &&
    ['ConditionalExpression', 'LogicalExpression'].includes(current.parent.type)
  ) {
    current = current.parent;
  }
  const container = current.parent;
  return (
    container?.type === 'JSXExpressionContainer' &&
    ['JSXElement', 'JSXFragment'].includes(container.parent?.type)
  );
}

const noHardcodedText = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow hard-coded user-facing text in components' },
    messages: {
      hardcoded:
        'Hard-coded UI text "{{text}}". Add it to src/locales/en.json and es.json and use t().',
    },
    schema: [],
  },
  create(context) {
    const report = (node, text) =>
      context.report({
        node,
        messageId: 'hardcoded',
        data: { text: String(text).trim().slice(0, 40) },
      });

    return {
      JSXText(node) {
        if (hasLetters(node.value)) report(node, node.value);
      },
      Literal(node) {
        if (typeof node.value !== 'string' || !hasLetters(node.value)) return;
        if (rendersAsChild(node)) report(node, node.value);
      },
      JSXAttribute(node) {
        if (!UI_ATTRIBUTES.has(node.name.name)) return;
        const value = node.value;
        if (value?.type === 'Literal' && hasLetters(value.value)) report(node, value.value);
        if (
          value?.type === 'JSXExpressionContainer' &&
          value.expression.type === 'Literal' &&
          typeof value.expression.value === 'string' &&
          hasLetters(value.expression.value)
        ) {
          report(node, value.expression.value);
        }
      },
    };
  },
};

export default noHardcodedText;
