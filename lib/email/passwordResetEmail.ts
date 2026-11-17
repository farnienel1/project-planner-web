// Transactional: no marketing content
import { escapeHtml } from '@/lib/security/htmlEscape'

/**
 * Branded password reset email (owner request 17 Nov): the same look as the new-user welcome email
 * (`welcomeEmailPack.ts`: navy hero with the logo, amber bar, blue button, link box, footer), with the reset link
 * Firebase generated server-side (`adminPasswordResetLink`, `returnOobLink: true`) so Firebase sends no email of
 * its own. `link` is passed in unescaped; this module escapes it.
 *
 * Firebase password reset codes are valid for one hour and can be used once.
 */

export const PASSWORD_RESET_EMAIL_SUBJECT = 'Reset your Project Planner password'
export const PASSWORD_RESET_LINK_VALID_TEXT = 'For your security, this link expires in 1 hour and can only be used once.'
export const PASSWORD_RESET_IGNORE_TEXT =
  "If you didn't ask to reset your password, you can ignore this email. Your password stays the same."

/** Who asked: the person themself (forgot password), Project Planner support (owner console), or a login email change. */
export type PasswordResetEmailReason = 'self' | 'support' | 'emailChanged'

export type PasswordResetEmailParams = {
  to: string
  link: string
  reason?: PasswordResetEmailReason
}

function introText(reason: PasswordResetEmailReason): string {
  if (reason === 'support') return 'Project Planner support has sent you a link to choose a new password.'
  if (reason === 'emailChanged') {
    return 'Your Project Planner login email was changed. Choose a password to sign in with this address.'
  }
  return 'We received a request to reset the password for your Project Planner login.'
}

const FONT = "-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"
const HEAD_FONT = "'Arial Black','Helvetica Neue',Arial,sans-serif"

export function buildPasswordResetEmailHtml(params: PasswordResetEmailParams): string {
  const link = escapeHtml(params.link)
  const to = escapeHtml(params.to.trim())
  const intro = escapeHtml(introText(params.reason ?? 'self'))
  const valid = escapeHtml(PASSWORD_RESET_LINK_VALID_TEXT)
  const ignore = escapeHtml(PASSWORD_RESET_IGNORE_TEXT)
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(PASSWORD_RESET_EMAIL_SUBJECT)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>td,th,div,p,a,h1,h2{font-family:Arial,sans-serif;}</style>
<![endif]-->
<style>
  :root{color-scheme:light dark;supported-color-schemes:light dark;}
  body{margin:0!important;padding:0!important;width:100%!important;background:#EEF2F7;}
  table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}
  img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;display:block;}
  a{color:#2563EB;}
  a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}
  u + #body a{color:inherit;text-decoration:none;}
  .hero{
    background-color:#0A1628;
    background-image:
      linear-gradient(rgba(103,232,249,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(103,232,249,0.05) 1px, transparent 1px),
      linear-gradient(135deg, #0A1628 0%, #0F2140 55%, #173563 100%)!important;
    background-size:40px 40px, 40px 40px, 100% 100%!important;
  }
  u + .body .hero{background-image:none!important;}
  .btn-link:hover{background-color:#1D4ED8!important;}
  @media screen and (max-width:620px){
    .container{width:100%!important;}
    .px{padding-left:24px!important;padding-right:24px!important;}
    .hero-pad{padding-top:32px!important;padding-bottom:36px!important;}
    .h1{font-size:28px!important;line-height:34px!important;}
    .logo{width:170px!important;height:auto!important;}
    .btn-table{width:100%!important;}
    .btn-link{display:block!important;text-align:center!important;}
  }
  @media (prefers-color-scheme: dark){
    body, .bg-page{background:#050B16!important;background-color:#050B16!important;}
    .card{background:#0E1A2E!important;background-color:#0E1A2E!important;}
    .hero{background-color:#0A1628!important;}
    .hero-ink{color:#FFFFFF!important;}
    .hero-sub{color:#B9CCE3!important;}
    .ink{color:#E6EDF6!important;}
    .muted{color:#A7B4C6!important;}
    .linkbox{background:#0A1628!important;background-color:#0A1628!important;border-color:#1E3354!important;}
    .linkbox a{color:#67E8F9!important;}
    .rule{border-color:#1E3354!important;}
    .foot-name{color:#E6EDF6!important;}
    .foot-link{color:#A7B4C6!important;}
    .btn{background:#2563EB!important;background-color:#2563EB!important;}
    .btn-link{background:#2563EB!important;color:#FFFFFF!important;}
  }
</style>
<style>
  [data-ogsc] .hero-ink{color:#FFFFFF!important;}
  [data-ogsc] .hero-sub{color:#B9CCE3!important;}
  [data-ogsc] .ink{color:#E6EDF6!important;}
  [data-ogsc] .muted{color:#A7B4C6!important;}
  [data-ogsc] .foot-name{color:#E6EDF6!important;}
  [data-ogsc] .foot-link{color:#A7B4C6!important;}
  [data-ogsc] .linkbox a{color:#67E8F9!important;}
  [data-ogsc] .btn-link{color:#FFFFFF!important;}
  [data-ogsb] .bg-page{background-color:#050B16!important;}
  [data-ogsb] .card{background-color:#0E1A2E!important;}
  [data-ogsb] .hero{background-color:#0A1628!important;}
  [data-ogsb] .linkbox{background-color:#0A1628!important;}
  [data-ogsb] .btn{background-color:#2563EB!important;}
</style>
</head>
<body id="body" class="body bg-page" bgcolor="#EEF2F7" style="margin:0;padding:0;background:#EEF2F7;background-color:#EEF2F7;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#EEF2F7;opacity:0;">
  Choose a new password for your Project Planner login. The link expires in 1 hour.
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" bgcolor="#EEF2F7" style="background:#EEF2F7;background-color:#EEF2F7;">
<tr><td class="bg-page" align="center" bgcolor="#EEF2F7" style="padding:32px 12px 40px 12px;background-color:#EEF2F7;">
  <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
    <tr>
      <td class="hero hero-pad px" bgcolor="#0A1628" style="background-color:#0A1628;border-radius:18px 18px 0 0;padding:40px 44px 44px 44px;">
        <a href="https://www.projectplanner.us" style="text-decoration:none;color:#FFFFFF;">
          <img class="logo" src="https://www.projectplanner.us/email-assets/pp-email-logo-on-navy.png" width="200" height="73" alt="Project Planner" style="width:200px;height:73px;color:#FFFFFF;font-family:Arial,sans-serif;font-size:20px;font-weight:bold;">
        </a>
        <h1 class="h1 hero-ink" style="margin:40px 0 0 0;font-family:${HEAD_FONT};font-weight:900;font-size:34px;line-height:40px;letter-spacing:-0.5px;color:#FFFFFF;">
          Reset your password
        </h1>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 18px 0;">
          <tr><td width="56" height="3" bgcolor="#F59E0B" style="width:56px;height:3px;background:#F59E0B;background-image:linear-gradient(#F59E0B,#F59E0B);font-size:0;line-height:0;border-radius:2px;">&nbsp;</td></tr>
        </table>
        <p class="hero-sub" style="margin:0;font-family:${FONT};font-size:17px;line-height:26px;color:#B9CCE3;">
          ${intro}
        </p>
      </td>
    </tr>
    <tr>
      <td class="card px" bgcolor="#FFFFFF" style="background:#FFFFFF;background-color:#FFFFFF;padding:40px 44px 12px 44px;">
        <p class="ink" style="margin:0 0 28px 0;font-family:${FONT};font-size:16px;line-height:26px;color:#0F1B2D;">
          Use the button below to choose a new password for <strong class="ink" style="color:#0F1B2D;font-weight:700;">${to}</strong>. You can then sign in on the web and in the mobile app.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-table">
          <tr>
            <td class="btn" align="center" bgcolor="#2563EB" style="border-radius:10px;background:#2563EB;background-color:#2563EB;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${link}" style="height:54px;v-text-anchor:middle;width:240px;" arcsize="19%" stroke="f" fillcolor="#2563EB">
                <w:anchorlock/>
                <center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Reset password</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a class="btn-link" href="${link}" target="_blank" style="display:inline-block;padding:17px 40px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;background:#2563EB;mso-padding-alt:0;">Reset password</a>
              <!--<![endif]-->
            </td>
          </tr>
        </table>
        <p class="muted" style="margin:14px 0 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:#5B6B82;">
          ${valid}
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:36px 0 28px 0;">
          <tr><td class="rule" style="border-top:1px solid #E3E9F1;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
        <p class="ink" style="margin:0 0 10px 0;font-family:${FONT};font-size:14px;line-height:21px;color:#0F1B2D;">
          Button not working? Copy this link into your browser:
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
          <tr>
            <td class="linkbox" bgcolor="#F4F7FB" style="background:#F4F7FB;background-color:#F4F7FB;border:1px solid #E3E9F1;border-radius:10px;padding:14px 16px;font-family:${FONT};font-size:13px;line-height:20px;word-break:break-all;">
              <a href="${link}" target="_blank" style="color:#2563EB;text-decoration:underline;">${link}</a>
            </td>
          </tr>
        </table>
        <p class="muted" style="margin:32px 0 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:#5B6B82;">
          ${ignore}
        </p>
        <p class="ink" style="margin:24px 0 0 0;font-family:${FONT};font-size:15px;line-height:22px;color:#0F1B2D;">
          Thanks,<br>Project Planner
        </p>
      </td>
    </tr>
    <tr>
      <td class="card" bgcolor="#FFFFFF" height="32" style="background:#FFFFFF;background-color:#FFFFFF;height:32px;border-radius:0 0 18px 18px;font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td class="px bg-page" bgcolor="#EEF2F7" style="padding:28px 44px 0 44px;background-color:#EEF2F7;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="middle" style="padding-right:12px;">
              <img src="https://www.projectplanner.us/email-assets/pp-email-icon.png" width="40" height="40" alt="" style="width:40px;height:40px;">
            </td>
            <td valign="middle">
              <p class="foot-name" style="margin:0;font-family:${HEAD_FONT};font-weight:900;font-size:14px;line-height:18px;color:#0A1628;">Project Planner</p>
              <p class="muted" style="margin:2px 0 0 0;font-family:${FONT};font-size:13px;line-height:18px;color:#5B6B82;">Built for construction teams</p>
            </td>
          </tr>
        </table>
        <p class="muted" style="margin:18px 0 0 0;font-family:${FONT};font-size:12px;line-height:19px;color:#5B6B82;">
          This email was sent to ${to} because a password reset was requested for this Project Planner login.<br>
          <a class="foot-link" href="https://www.projectplanner.us" style="color:#5B6B82;text-decoration:underline;">projectplanner.us</a>
        </p>
      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`
}

export function buildPasswordResetEmailText(params: PasswordResetEmailParams): string {
  return [
    'Reset your password',
    '',
    introText(params.reason ?? 'self'),
    '',
    `Choose a new password for ${params.to.trim()}:`,
    params.link,
    '',
    PASSWORD_RESET_LINK_VALID_TEXT,
    '',
    PASSWORD_RESET_IGNORE_TEXT,
    '',
    'Thanks,',
    'Project Planner',
    '',
    '--',
    'Project Planner, built for construction teams',
    `This email was sent to ${params.to.trim()} because a password reset was requested for this Project Planner login.`,
    'https://www.projectplanner.us',
  ].join('\n')
}
