// MCP 파일 배포용: deploy-bundle.b64(tar.gz)를 풀어 소스 복원 후 빌드. (로컬/Git 배포에서는 번들이 없으면 건너뜀)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
if (existsSync('deploy-bundle.b64')) {
  writeFileSync('/tmp/deploy-bundle.tgz', Buffer.from(readFileSync('deploy-bundle.b64', 'utf8'), 'base64'));
  execSync('tar xzf /tmp/deploy-bundle.tgz', { stdio: 'inherit' });
  console.log('[unpack] restored source from deploy-bundle.b64');
} else console.log('[unpack] no bundle, skip');
