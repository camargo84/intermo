/**
 * Protege documentos mascarados (ex.: CPF "***.***.123-45") e números pontuados
 * da formatação markdown antes de passar por um renderer (react-markdown).
 *
 * Problema: o assistente, por instrução do system prompt, mascara CPF/CNPJ com
 * asteriscos ("***.***.123-45"). O react-markdown interpreta `***...***` como
 * ênfase (negrito+itálico) e COME os asteriscos, corrompendo a conferência do
 * dado pelo vendedor.
 *
 * Estratégia: dentro de uma "run" composta apenas por caracteres de documento
 * (`* _ . - / ` e dígitos), se houver pelo menos um asterisco/underscore E pelo
 * menos um dígito, escapamos todos os `*`/`_` daquela run. Assim a redação fica
 * literal e a ênfase legítima sobre palavras (`**Cliente:**`, `*importante*`)
 * é preservada, porque essas não contêm dígitos.
 */
export function sanitizeMarkdown(text: string): string {
  return text.replace(/[\d*_./-]+/g, (run) => {
    if (/[*_]/.test(run) && /\d/.test(run)) {
      return run.replace(/([*_])/g, "\\$1");
    }
    return run;
  });
}
