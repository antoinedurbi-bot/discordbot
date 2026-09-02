// Insère des caractères invisibles (espace de largeur nulle) dans le texte.
// Invisible dans le rendu Discord (le texte reste parfaitement propre à l'affichage),
// mais pollue le texte si quelqu'un le copie-colle ailleurs. Ce n'est pas un vrai
// blocage de copie (impossible via l'API Discord), juste un frein.
const ZERO_WIDTH_SPACE = '​';

export function obfuscateText(text) {
  if (!text) return text;
  let result = '';
  for (let i = 0; i < text.length; i += 1) {
    result += text[i];
    if ((i + 1) % 3 === 0 && i !== text.length - 1) {
      result += ZERO_WIDTH_SPACE;
    }
  }
  return result;
}
