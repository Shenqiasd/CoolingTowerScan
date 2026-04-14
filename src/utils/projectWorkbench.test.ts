import assert from 'node:assert/strict';
import test from 'node:test';

import type { Project } from '../types/project.ts';
import { buildProjectWorkbenchSummary } from './projectWorkbench.ts';

function createProject(overrides: Partial<Project>): Project {
  return {
    id: 'project-1',
    enterprise_id: 'enterprise-1',
    name: '长鑫存储项目',
    current_phase: 'prospecting',
    current_stage_code: 'prospecting',
    current_stage_status: 'in_progress',
    phase_data: {
      prospecting: {},
      qualification: {},
      survey: {},
      proposal: {},
      bidding: {},
      execution: {},
      commissioning: {},
      operations: {},
    },
    opportunity_score: 0,
    priority: 'medium',
    assigned_to: null,
    status: 'active',
    created_at: '2026-04-13T08:00:00.000Z',
    updated_at: '2026-04-13T08:00:00.000Z',
    ...overrides,
  };
}

test('buildProjectWorkbenchSummary counts waiting approval blocked overdue and handoff items', () => {
  const now = '2026-04-13T12:00:00.000Z';
  const projects = [
    createProject({
      id: 'approval',
      current_stage_status: 'pending_approval',
      phase_data: {
        prospecting: {
          dueAt: '2026-04-14T12:00:00.000Z',
          pendingHandoffs: [],
          blockers: [],
        },
        qualification: {},
        survey: {},
        proposal: {},
        bidding: {},
        execution: {},
        commissioning: {},
        operations: {},
      },
    }),
    createProject({
      id: 'blocked',
      current_stage_status: 'blocked',
      phase_data: {
        prospecting: {
          dueAt: '2026-04-14T12:00:00.000Z',
          pendingHandoffs: [],
          blockers: ['缺现场联系人'],
        },
        qualification: {},
        survey: {},
        proposal: {},
        bidding: {},
        execution: {},
        commissioning: {},
        operations: {},
      },
    }),
    createProject({
      id: 'overdue',
      current_stage_status: 'in_progress',
      phase_data: {
        prospecting: {
          dueAt: '2026-04-12T12:00:00.000Z',
          pendingHandoffs: ['等待技术交接'],
          blockers: [],
        },
        qualification: {},
        survey: {},
        proposal: {},
        bidding: {},
        execution: {},
        commissioning: {},
        operations: {},
      },
    }),
  ];

  const summary = buildProjectWorkbenchSummary(projects, now);

  assert.equal(summary.waitingApproval, 1);
  assert.equal(summary.blocked, 1);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.pendingHandoffs, 1);
});

test('buildProjectWorkbenchSummary ignores completed and waived stages in overdue counts', () => {
  const now = '2026-04-13T12:00:00.000Z';
  const projects = [
    createProject({
      id: 'completed',
      current_stage_status: 'completed',
      phase_data: {
        prospecting: {
          dueAt: '2026-04-10T12:00:00.000Z',
          pendingHandoffs: [],
          blockers: [],
        },
        qualification: {},
        survey: {},
        proposal: {},
        bidding: {},
        execution: {},
        commissioning: {},
        operations: {},
      },
    }),
    createProject({
      id: 'waived',
      current_stage_status: 'waived',
      phase_data: {
        prospecting: {
          dueAt: '2026-04-10T12:00:00.000Z',
          pendingHandoffs: [],
          blockers: [],
        },
        qualification: {},
        survey: {},
        proposal: {},
        bidding: {},
        execution: {},
        commissioning: {},
        operations: {},
      },
    }),
  ];

  const summary = buildProjectWorkbenchSummary(projects, now);

  assert.equal(summary.overdue, 0);
  assert.equal(summary.waitingApproval, 0);
  assert.equal(summary.blocked, 0);
  assert.equal(summary.pendingHandoffs, 0);
});
