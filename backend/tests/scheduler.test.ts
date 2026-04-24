import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getApp, getDb } from './_helpers';
import { resolveCurrentLayout } from '../src/services/scheduler';

describe('scheduler.resolveCurrentLayout', () => {
  before(async () => { await getApp(); });

  beforeEach(() => {
    const db = getDb();
    db.exec('DELETE FROM schedules');
    db.exec('DELETE FROM displays');
    db.exec('DELETE FROM layouts');
  });

  function seedLayout(name: string, definition: object = { regions: [] }): number {
    const info = getDb().prepare(`
      INSERT INTO layouts (name, width, height, background_color, definition, published)
      VALUES (?, 1920, 1080, '#000000', ?, 1)
    `).run(name, JSON.stringify(definition));
    return Number(info.lastInsertRowid);
  }

  function seedDisplay(name: string, currentLayoutId: number | null = null): number {
    const info = getDb().prepare(`
      INSERT INTO displays (name, resolution, orientation, current_layout_id)
      VALUES (?, '1920x1080', 'landscape', ?)
    `).run(name, currentLayoutId);
    return Number(info.lastInsertRowid);
  }

  it('returns fallback when nothing is configured', () => {
    const displayId = seedDisplay('blank');
    const layout = resolveCurrentLayout(displayId, null);
    assert.equal(layout.source, 'fallback');
    assert.equal(layout.id, null);
  });

  it('falls back to display.current_layout_id when no schedule matches', () => {
    const layoutId = seedLayout('default');
    const displayId = seedDisplay('with-default', layoutId);
    const result = resolveCurrentLayout(displayId, null);
    assert.equal(result.source, 'current');
    assert.equal(result.id, layoutId);
  });

  it('uses zone-wide schedule when active', () => {
    const layoutId = seedLayout('zone-layout');
    const displayId = seedDisplay('member');
    getDb().prepare(`
      INSERT INTO schedules (layout_id, zone_id, name, priority, active)
      VALUES (?, NULL, 'all-time', 10, 1)
    `).run(layoutId);
    const result = resolveCurrentLayout(displayId, null);
    // zone_id null does not match either; should fallback
    assert.equal(result.source, 'fallback');
  });

  it('display-specific schedule overrides current_layout_id', () => {
    const a = seedLayout('current');
    const b = seedLayout('scheduled');
    const displayId = seedDisplay('main', a);
    getDb().prepare(`
      INSERT INTO schedules (layout_id, display_id, name, priority, active)
      VALUES (?, ?, 'override', 50, 1)
    `).run(b, displayId);
    const result = resolveCurrentLayout(displayId, null);
    assert.equal(result.id, b);
    assert.equal(result.source, 'schedule');
  });

  it('respects days_of_week filter', () => {
    const layoutId = seedLayout('weekend-only');
    const displayId = seedDisplay('main');
    const today = new Date().getDay();
    const otherDays = [0, 1, 2, 3, 4, 5, 6].filter(d => d !== today).join(',');
    getDb().prepare(`
      INSERT INTO schedules (layout_id, display_id, name, priority, active, days_of_week)
      VALUES (?, ?, 'other-days', 100, 1, ?)
    `).run(layoutId, displayId, otherDays);
    const result = resolveCurrentLayout(displayId, null);
    // No match because today is excluded
    assert.equal(result.source, 'fallback');
  });

  it('matches schedule when current weekday is included', () => {
    const layoutId = seedLayout('today-yes');
    const displayId = seedDisplay('main');
    const today = new Date().getDay();
    getDb().prepare(`
      INSERT INTO schedules (layout_id, display_id, name, priority, active, days_of_week)
      VALUES (?, ?, 'today-only', 100, 1, ?)
    `).run(layoutId, displayId, String(today));
    const result = resolveCurrentLayout(displayId, null);
    assert.equal(result.id, layoutId);
    assert.equal(result.source, 'schedule');
  });

  it('respects start_time / end_time window', () => {
    const layoutId = seedLayout('night-only');
    const displayId = seedDisplay('main');
    // A window that explicitly does NOT include "now"
    getDb().prepare(`
      INSERT INTO schedules (layout_id, display_id, name, priority, active, start_time, end_time)
      VALUES (?, ?, 'after-hours', 100, 1, '23:59', '23:59')
    `).run(layoutId, displayId);
    const result = resolveCurrentLayout(displayId, null);
    assert.equal(result.source, 'fallback');
  });
});
