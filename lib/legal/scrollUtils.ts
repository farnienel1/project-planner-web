export function isScrolledToBottom(
  el: { scrollTop: number; clientHeight: number; scrollHeight: number },
  slack = 16
): boolean {
  if (el.scrollHeight <= el.clientHeight + slack) return true
  return el.scrollTop + el.clientHeight >= el.scrollHeight - slack
}

export function passwordsMatchAndReady(password: string, confirmPassword: string, minLength = 8): boolean {
  return password.length >= minLength && password === confirmPassword
}
