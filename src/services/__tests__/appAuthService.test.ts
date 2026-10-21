import { describe, it, expect, beforeEach } from 'vitest';
import { AppAuthService } from '../appAuthService';

describe('AppAuthService (Web Application Authentication)', () => {
  beforeEach(() => {
    AppAuthService.logout();
  });

  it('should start unauthenticated when storage is empty', () => {
    expect(AppAuthService.isAuthenticated()).toBe(false);
    expect(AppAuthService.getCurrentUser()).toBeNull();
  });

  it('should authenticate successfully with default master PIN 9096', () => {
    const res = AppAuthService.loginWithPin('9096', true);
    expect(res.success).toBe(true);
    expect(res.user?.username).toBe('pro_trader');
    expect(AppAuthService.isAuthenticated()).toBe(true);
    expect(AppAuthService.getCurrentUser()?.username).toBe('pro_trader');
  });

  it('should reject invalid PIN', () => {
    const res = AppAuthService.loginWithPin('12', true);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(AppAuthService.isAuthenticated()).toBe(false);
  });

  it('should authenticate with username and password', () => {
    const res = AppAuthService.loginWithCredentials('trader', '9096', true);
    expect(res.success).toBe(true);
    expect(res.user?.role).toBe('TRADER');
    expect(AppAuthService.isAuthenticated()).toBe(true);
  });

  it('should support instant 1-click access', () => {
    const user = AppAuthService.instantAccess();
    expect(user.username).toBe('algo_trader');
    expect(AppAuthService.isAuthenticated()).toBe(true);
  });

  it('should logout cleanly and clear session', () => {
    AppAuthService.loginWithPin('9096', true);
    expect(AppAuthService.isAuthenticated()).toBe(true);

    AppAuthService.logout();
    expect(AppAuthService.isAuthenticated()).toBe(false);
    expect(AppAuthService.getCurrentUser()).toBeNull();
  });
});
