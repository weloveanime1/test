export async function checkSession(): Promise<boolean> {
  const res = await fetch('/api/auth');
  await res.text();
  return res.ok;
}

export async function login(password: string): Promise<boolean> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  await res.text();
  if (res.ok) return true;
  if (res.status === 401) return false;
  throw new Error('The server could not check the password.');
}

export const logout = () => fetch('/api/auth', { method: 'DELETE' }).catch(() => {});
