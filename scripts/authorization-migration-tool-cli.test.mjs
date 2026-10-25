import {expect, it, vi} from 'vitest';
import {parseMigrationArguments, runMigrationCli} from './authorization-migration.mjs';
import * as cli from './authorization-migration.mjs';
import * as state from './authorization-migration-state.mjs';
import * as tool from './authorization-migration-tool-source.mjs';

it('keeps only the reusable migration commands in help and exports no exception writer', async () => {
  const result = await runMigrationCli(['--help']);
  expect(result.usage).toContain('plan|prepare|status|audit|gate|apply|unlock>');
  expect(result.usage).not.toMatch(/abort-freeze|adopt-tool-source/);
  expect(cli.reviewedAbortSource).toBeUndefined();
  expect(state.abortMigrationFreeze).toBeUndefined();
  expect(tool.adoptMigrationToolSource).toBeUndefined();
  expect(typeof tool.verifyMigrationToolSource).toBe('function');
});
for (const projectId of ['sodc-web', 'sodc-web-beta', 'sodc-web-production']) {
  for (const command of ['abort-freeze', 'adopt-tool-source']) it('rejects retired ' + command + ' for ' + projectId + ' before credentials or any adapter', async () => {
    const git = vi.fn(), loadAdapter = vi.fn();
    const env = new Proxy({}, {get() {throw Error('Must not inspect credentials');}});
    await expect(runMigrationCli([command, '--project', projectId], {env, git, loadAdapter})).rejects.toMatchObject({code: 'COMMAND_INVALID'});
    expect(git).not.toHaveBeenCalled(); expect(loadAdapter).not.toHaveBeenCalled();
  });
}
for (const flag of ['--completed-open-verification', '--production-pre-api-open-recovery', '--previous-amendment', '--tool-sha', '--review-reference']) {
  it('cannot re-enable a historical source exception through normal apply ' + flag, async () => {
    const git = vi.fn(), loadAdapter = vi.fn();
    await expect(runMigrationCli(['apply', '--project', 'sodc-web', '--run-id', 'reviewed-run', '--phase', 'inspect', '--confirm-project', 'sodc-web', flag, 'unreviewed'], {git, loadAdapter})).rejects.toMatchObject({code: 'FLAG_INVALID'});
    expect(git).not.toHaveBeenCalled(); expect(loadAdapter).not.toHaveBeenCalled();
  });
}
it('keeps the explicit reviewed legacy import switch for reusable normal migrations', () => {
  expect(parseMigrationArguments(['prepare', '--project', 'sodc-web-beta', '--run-id', 'reviewed-run', '--operator', 'operator', '--reason', 'approved new installation', '--installation', 'legacy', '--artifact-directory', '/tmp/new-reviewed-artifacts', '--import-admins'])).toMatchObject({command: 'prepare', flags: {'import-admins': true}});
});
