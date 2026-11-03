'use strict'

/**
 * JavaScript copy of web `lib/email/emailTheme.ts` (light and dark mode for the simple transactional emails),
 * generated from it with esbuild. `lib/email/emailFunctionParity.test.ts` fails when the two differ.
 */

const EMAIL_LIGHT = {
  page: "#EEF2F7",
  card: "#FFFFFF",
  panel: "#F4F7FB",
  rule: "#E3E9F1",
  heading: "#0A1628",
  ink: "#0F1B2D",
  muted: "#475569",
  small: "#5B6B82",
  link: "#1D4ED8",
  button: "#2563EB",
  buttonText: "#FFFFFF",
  brand: "#1D4ED8",
  noteBg: "#FEF3C7",
  noteBorder: "#FCD34D",
  noteInk: "#78350F"
};
const EMAIL_DARK = {
  page: "#050B16",
  card: "#0E1A2E",
  panel: "#0A1628",
  rule: "#1E3354",
  heading: "#F8FAFC",
  ink: "#E6EDF6",
  muted: "#B6C2D2",
  small: "#94A3B8",
  link: "#93C5FD",
  button: "#2563EB",
  buttonText: "#FFFFFF",
  brand: "#93C5FD",
  noteBg: "#3A2A06",
  noteBorder: "#7C5A0B",
  noteInk: "#FDE68A"
};
const L = EMAIL_LIGHT;
const D = EMAIL_DARK;
const EMAIL_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const EMAIL_COLOR_SCHEME_META = '<meta name="color-scheme" content="light dark">\n<meta name="supported-color-schemes" content="light dark">';
const EMAIL_THEME_STYLE = `<style>
  :root{color-scheme:light dark;supported-color-schemes:light dark;}
  body{margin:0!important;padding:0!important;width:100%!important;background-color:${L.page};}
  table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}
  a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}
  @media screen and (max-width:620px){
    .pp-container{width:100%!important;}
    .pp-pad{padding-left:22px!important;padding-right:22px!important;}
  }
  @media (prefers-color-scheme: dark){
    body, .pp-page{background-color:${D.page}!important;}
    .pp-card{background-color:${D.card}!important;}
    .pp-panel{background-color:${D.panel}!important;border-color:${D.rule}!important;}
    .pp-rule{border-color:${D.rule}!important;}
    .pp-heading{color:${D.heading}!important;}
    .pp-ink{color:${D.ink}!important;}
    .pp-muted{color:${D.muted}!important;}
    .pp-small{color:${D.small}!important;}
    .pp-brand{color:${D.brand}!important;}
    .pp-link{color:${D.link}!important;}
    .pp-btn{background-color:${D.button}!important;}
    .pp-btn-text{background-color:${D.button}!important;color:${D.buttonText}!important;}
    .pp-note{background-color:${D.noteBg}!important;border-color:${D.noteBorder}!important;}
    .pp-note-ink{color:${D.noteInk}!important;}
  }
</style>
<style>
  [data-ogsc] .pp-heading{color:${D.heading}!important;}
  [data-ogsc] .pp-ink{color:${D.ink}!important;}
  [data-ogsc] .pp-muted{color:${D.muted}!important;}
  [data-ogsc] .pp-small{color:${D.small}!important;}
  [data-ogsc] .pp-brand{color:${D.brand}!important;}
  [data-ogsc] .pp-link{color:${D.link}!important;}
  [data-ogsc] .pp-btn-text{color:${D.buttonText}!important;}
  [data-ogsc] .pp-note-ink{color:${D.noteInk}!important;}
  [data-ogsb] .pp-page{background-color:${D.page}!important;}
  [data-ogsb] .pp-card{background-color:${D.card}!important;}
  [data-ogsb] .pp-panel{background-color:${D.panel}!important;}
  [data-ogsb] .pp-btn{background-color:${D.button}!important;}
  [data-ogsb] .pp-note{background-color:${D.noteBg}!important;}
</style>`;
function escapeText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function emailDocument(input) {
  const width = input.maxWidth ?? 600;
  const preheader = input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${L.page};opacity:0;">${escapeText(input.preheader)}</div>
` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
${EMAIL_COLOR_SCHEME_META}
<title>${escapeText(input.title)}</title>
${EMAIL_THEME_STYLE}
</head>
<body class="body pp-page" bgcolor="${L.page}" style="margin:0;padding:0;background-color:${L.page};">
${preheader}<table role="presentation" class="pp-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${L.page}" style="background-color:${L.page};">
<tr><td class="pp-page" align="center" bgcolor="${L.page}" style="padding:28px 12px 36px 12px;background-color:${L.page};">
<table role="presentation" class="pp-container" width="${width}" cellpadding="0" cellspacing="0" border="0" style="width:${width}px;max-width:${width}px;">
<tr><td class="pp-card pp-pad" bgcolor="${L.card}" style="padding:32px 36px;background-color:${L.card};border-radius:14px;font-family:${EMAIL_FONT};font-size:16px;line-height:24px;color:${L.ink};">
${input.body}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
const TEXT_STYLE = {
  ink: { cls: "pp-ink", style: `font-size:16px;line-height:24px;color:${L.ink};` },
  muted: { cls: "pp-muted", style: `font-size:14px;line-height:21px;color:${L.muted};` },
  small: { cls: "pp-small", style: `font-size:12px;line-height:18px;color:${L.small};` },
  heading: { cls: "pp-heading", style: `font-size:24px;line-height:30px;font-weight:700;color:${L.heading};` },
  brand: {
    cls: "pp-brand",
    style: `font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${L.brand};`
  }
};
function emailText(html, kind = "ink", extra = "") {
  const t = TEXT_STYLE[kind];
  return `<p class="${t.cls}" style="margin:0 0 16px 0;font-family:${EMAIL_FONT};${t.style}${extra}">${html}</p>`;
}
function emailBrand() {
  return emailText("Project Planner", "brand", "margin:0 0 8px 0;");
}
function emailHeading(html) {
  return `<h1 class="pp-heading" style="margin:0 0 20px 0;font-family:${EMAIL_FONT};font-size:24px;line-height:30px;font-weight:700;color:${L.heading};">${html}</h1>`;
}
function emailStrong(html, kind = "heading") {
  return `<strong class="pp-${kind}" style="color:${kind === "ink" ? L.ink : L.heading};font-weight:700;">${html}</strong>`;
}
function emailLink(href, label) {
  return `<a class="pp-link" href="${href}" style="color:${L.link};text-decoration:underline;">${label}</a>`;
}
function emailButton(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr><td class="pp-btn" align="center" bgcolor="${L.button}" style="border-radius:10px;background-color:${L.button};">
<a class="pp-btn-text" href="${href}" target="_blank" style="display:inline-block;padding:13px 22px;font-family:${EMAIL_FONT};font-size:16px;line-height:20px;font-weight:700;color:${L.buttonText};text-decoration:none;border-radius:10px;background-color:${L.button};">${label}</a>
</td></tr>
</table>`;
}
function emailCode(code) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
<tr><td class="pp-panel" bgcolor="${L.panel}" style="padding:14px 20px;background-color:${L.panel};border:1px solid ${L.rule};border-radius:10px;font-family:${EMAIL_FONT};font-size:32px;line-height:38px;font-weight:800;letter-spacing:0.18em;color:${L.heading};"><span class="pp-heading" style="color:${L.heading};">${code}</span></td></tr>
</table>`;
}
function emailNote(html) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 0 8px 0;">
<tr><td class="pp-note" bgcolor="${L.noteBg}" style="padding:14px 16px;background-color:${L.noteBg};border:1px solid ${L.noteBorder};border-radius:8px;">
<p class="pp-note-ink" style="margin:0;font-family:${EMAIL_FONT};font-size:13px;line-height:20px;color:${L.noteInk};">${html}</p>
</td></tr>
</table>`;
}
function emailLinkPanel(href, label) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 0 24px 0;">
<tr><td class="pp-panel" bgcolor="${L.panel}" style="padding:12px 14px;background-color:${L.panel};border:1px solid ${L.rule};border-radius:8px;font-family:${EMAIL_FONT};font-size:13px;line-height:20px;word-break:break-all;">${emailLink(href, label)}</td></tr>
</table>`;
}
function emailFooter(html) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;">
<tr><td class="pp-rule" style="border-top:1px solid ${L.rule};padding-top:16px;font-family:${EMAIL_FONT};">
<p class="pp-small" style="margin:0;font-family:${EMAIL_FONT};font-size:12px;line-height:19px;color:${L.small};">${html}</p>
</td></tr>
</table>`;
}
function emailList(items) {
  return `<ul class="pp-ink" style="margin:0 0 16px 0;padding-left:22px;font-family:${EMAIL_FONT};font-size:16px;line-height:24px;color:${L.ink};">${items.map((item) => `<li class="pp-ink" style="margin:0 0 4px 0;color:${L.ink};">${item}</li>`).join("")}</ul>`;
}

module.exports = {
  EMAIL_COLOR_SCHEME_META,
  EMAIL_DARK,
  EMAIL_FONT,
  EMAIL_LIGHT,
  EMAIL_THEME_STYLE,
  emailBrand,
  emailButton,
  emailCode,
  emailDocument,
  emailFooter,
  emailHeading,
  emailLink,
  emailLinkPanel,
  emailList,
  emailNote,
  emailStrong,
  emailText,
}
