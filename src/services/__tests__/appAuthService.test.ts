import { describe, it, expect, beforeEach } from 'vitest';
import { AppAuthService } from '../appAuthService';

describe('AppAuthService (Taufik Patel Authentication)', () => {
  beforeEach(() => {
    AppAuthService.logout();
  });

  it('should start unauthenticated when storage is empty', () => {
    expect(AppAuthService.isAuthenticated()).toBe(false);
    expect(AppAuthService.getCurrentUser()).toBeNull();
  });

  it('should authenticate successfully with tufikpatel23@gmail.com and Taufik@786', () => {
    const res = AppAuthService.loginWithCredentials('tufikpatel23@gmail.com', 'Taufik@786', true);
    expect(res.success).toBe(true);
    expect(res.user?.name).toBe('Taufik Patel');
    expect(res.user?.email).toBe('tufikpatel23@gmail.com');
    expect(AppAuthService.isAuthenticated()).toBe(true);
    expect(AppAuthService.getCurrentUser()?.name).toBe('Taufik Patel');
  });

  it('should authenticate with username taufik and password Taufik@786', () => {
    const res = AppAuthService.loginWithCredentials('taufik', 'Taufik@786', true);
    expect(res.success).toBe(true);
    expect(res.user?.name).toBe('Taufik Patel');
  });

  it('should authenticate successfully with master PIN 9096', () => {
    const res = AppAuthService.loginWithPin('9096', true);
    expect(res.success).toBe(true);
    expect(res.user?.name).toBe('Taufik Patel');
    expect(AppAuthService.isAuthenticated()).toBe(true);
  });

  it('should reject invalid password for tufikpatel23@gmail.com', () => {
    const res = AppAuthService.loginWithCredentials('tufikpatel23@gmail.com', 'WrongPass', true);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(AppAuthService.isAuthenticated()).toBe(false);
  });

  it('should support instant 1-click access as Taufik Patel', () => {
    const user = AppAuthService.instantAccess();
    expect(user.name).toBe('Taufik Patel');
    expect(user.email).toBe('tufikpatel23@gmail.com');
    expect(AppAuthService.isAuthenticated()).toBe(true);
  });

  it('should logout cleanly and clear session', () => {
    AppAuthService.loginWithCredentials('tufikpatel23@gmail.com', 'Taufik@786', true);
    expect(AppAuthService.isAuthenticated()).toBe(true);

    AppAuthService.logout();
    expect(AppAuthService.isAuthenticated()).toBe(false);
    expect(AppAuthService.getCurrentUser()).toBeNull();
  });
});
