# 성균관대 해커톤 앱 스타터

공식 app-tutorial-ts 기반입니다. 팀별로 이 저장소를 복제하고 앱 ID와 비밀 키를 분리합니다.
SDK 0.17.2, pnpm 11.24.0, Node.js 24를 사용합니다. 행사 중 의존성 버전은 임의로 변경하지 않습니다.

## 로컬 개발

```sh
corepack pnpm install --frozen-lockfile
cp server/.env.example server/.env
corepack pnpm build
corepack pnpm dev:server
# 별도 터미널
corepack pnpm dev:wam
```

서버 Function은 `server/src/tutorial.functions.ts`, 화면은 `wam/src/pages/Send/Send.tsx`,
공유 입력·출력 타입은 `packages/shared/src/index.ts`에서 수정합니다.
서버 로컬 실행은 기본적으로 앱을 자동 등록합니다. 배포 URL이 등록된 앱을 로컬에서 실험할 때는
`AUTO_REGISTER=false`로 실행하고, 별도 개발 앱을 사용하세요.

## 현재 배포 대상: Cloudflare Workers Free + D1

유료 플랜이나 자동 과금 Trial을 사용하지 않습니다. 계정당 D1 개수와 무료 사용량 한도가 있으므로
11개 팀 전체 배치는 계정 운영 조건 확인 후 확정합니다. 현재 원격 계정·DB는 아직 연결하지 않았습니다.

- 팀별 Worker 1개와 D1 1개를 사용합니다. `wrangler.jsonc`의 DB ID는 로컬용 자리표시자입니다.
- Cloudflare 서버 진입점은 `cloudflare/worker.mjs`, SQL 마이그레이션은 `cloudflare/migrations`입니다.
- NestJS HTTP와 SDK Function은 유지합니다. 선택 기능인 WebSocket, microservices, class-validator,
  class-transformer는 이 Workers 빌드에서 제외합니다. 입력 검증은 기존 Zod를 사용합니다.
- `server/src/database.ts`의 `getDatabase()`는 현재 요청에 연결된 해당 팀 D1만 반환합니다.
- DB 예제 테이블 `app_records`에는 id, JSON 값, 생성/수정 시각이 있습니다. UPDATE 시 updated_at은
  쿼리에서 갱신하세요. 팀 기능에 맞는 테이블을 마이그레이션으로 추가합니다.

```sh
corepack pnpm build:cloudflare
# .dev.vars에 로컬 테스트용 APP_ID, APP_SECRET, SIGNING_KEY를 입력합니다.
corepack pnpm db:migrate:local
corepack pnpm dev:cloudflare
```

```ts
import { getDatabase } from "./database.js";
const record = await getDatabase()
  .prepare("SELECT value_json FROM app_records WHERE id = ?")
  .bind(recordId)
  .first<{ value_json: string }>();
```

기존 `dev:server`는 D1을 제공하지 않습니다. DB를 쓰는 기능은 Wrangler 로컬 런타임에서 개발하세요.
실제 앱과 연결하려면 운영진이 원격 D1 생성·마이그레이션, 앱 자격 증명, 고정 Worker 주소 및
Function/WAM Endpoint를 설정하고 등록·설치 검증을 해야 합니다.

### 팀별 자율 배포

운영진 전용 배포 저장소가 각 팀 `main`의 새 커밋을 확인합니다. 팀별로 push하면 자기 Worker만
배포됩니다. 초기 구현은 5분 주기이며 GitHub 스케줄 지연으로 더 늦어질 수 있습니다.
같은 코드를 다시 배포하려면 빈 커밋을 push하거나 운영진에게 재배포를 요청합니다.
이 컨트롤러는 아직 원격 활성화 전입니다.

Cloudflare 계정 토큰은 팀 레포에 저장하지 않습니다. 비밀정보 없는 빌드와 토큰을 사용하는 업로드를
별도 실행 환경으로 분리하고, Worker 이름·계정·DB 연결은 운영진의 고정 매핑만 사용합니다.
팀 코드가 운영진 설정을 변경해 다른 팀 DB를 연결할 수 없게 합니다.
DB 마이그레이션은 코드 재배포와 별도이며 초기에는 운영진이 대상 DB와 SQL을 확인해 적용합니다.
단순 재배포로 D1 데이터는 초기화되지 않습니다.

### 파일럿 검증 상태

Workers 로컬 실행, HMAC 검증/거부, 동시 호출, WAM 정적 파일, D1 로컬 마이그레이션 및
저장·조회·삭제는 검증했습니다. 원격 무료 CPU 한도, 실제 채널톡 설치·호스트 실행과
운영진 배포 파이프라인 E2E는 아직 검증하지 않았습니다.

## 이전 Vercel 설정 (현재 사용하지 않음)

1. 팀 레포를 Vercel 프로젝트에 연결합니다. Root Directory는 저장소 루트, Framework는 Other,
   Node.js는 24.x, 운영 브랜치는 main입니다. `vercel.json`의 설치·빌드 명령을 사용합니다.
2. Production 환경변수에 해당 팀의 `APP_ID`, `APP_SECRET`, `SIGNING_KEY`를 설정합니다.
   비밀 키는 서버 환경에만 저장하고 Git, WAM, 이메일 본문에 넣지 않습니다.
   Preview에는 운영 자격 증명을 복사하지 않습니다. Preview 앱 검증은 별도 앱이 필요합니다.
3. 배포 후 고정 Production 도메인을 확인합니다. `/api/health`의 200 응답은 프로세스 확인일 뿐
   앱 등록·권한·Function 성공을 증명하지 않습니다.
4. 앱 개발자 설정에 Function Endpoint `https://HOST/functions`,
   WAM Endpoint `https://HOST/resource/wam`을 저장합니다. `/v1`, `/tutorial`을 덧붙이지 않습니다.
5. 해당 팀 자격 증명을 로컬 `server/.env`에 안전하게 설정한 뒤 `corepack pnpm register`를 실행합니다.
   이 명령은 실제 앱의 Extension 등록을 변경합니다. 배포된 URL이 먼저 응답해야 합니다.
   Vercel의 콜드 스타트에서는 자동 등록하지 않습니다.
6. 해당 팀 개발 채널에 앱을 설치합니다. `writeGroupMessage`, `writeGroupMessageAsManager`는
   튜토리얼 메시지 예제에 필요합니다. 팀의 기능에 맞춰 필요한 권한만 설정합니다.
7. 채널의 테스트 그룹에서 `/tutorial`을 실행해 WAM을 열고 두 전송 경로를 검증합니다.
   실제 메시지가 생성되므로 운영진이 지정한 테스트 그룹에서 실행합니다.
8. Vercel Deployment Protection이 Function 호출 또는 WAM 로드를 막지 않는지 확인합니다.
   Function의 서명 검증은 유지합니다. 다른 팀의 앱·프로젝트 접근 권한이 없는지도 확인합니다.

## 팀장 인계

GitHub 레포, Vercel 프로젝트, 앱 관리 화면, 개발 채널 URL과 초대 수락 여부를 전달합니다.
각 팀장이 작은 화면 변경을 push하고 실제 채널에서 확인해야 인계 완료입니다.
Function 스키마·Extension 메타데이터 변경 후에는 배포 완료 후 운영진과 등록 갱신을 진행합니다.
일반 로직/UI 변경은 재배포 후 확인합니다. 비밀 키를 문의 채널에 붙여 넣지 마세요.

## 검증과 장애 대응

```sh
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm build:vercel
corepack pnpm test:vercel
```

서버리스 산출물은 `.vercel/output`입니다. 로컬 smoke는 합성 자격 증명을 사용하며 외부 API 호출을
차단합니다. 실제 Vercel 라우팅·앱 설치·호스트 WAM 실행은 별도로 검증해야 합니다.
서버리스에서는 메모리와 로컬 파일을 영속 저장소로 사용하지 않습니다.
실패하면 Vercel 로그, 마지막 정상 배포, 앱 Endpoint·권한·서명 키를 순서대로 확인합니다.
지원 종료일과 비용 한도는 운영진 안내를 따릅니다.
