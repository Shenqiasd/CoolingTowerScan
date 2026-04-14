# HVAC Research Module Platform Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有调研/评估/方案系统接入主平台，形成“平台主干 + 调研评估专业子系统”的一阶段可上线方案。

**Architecture:** 平台负责主数据、主流程、审批和正式版本；现有后端保留为独立域服务，现有前端改造成平台业务模块。第一阶段使用 API 同步与项目映射，第二阶段再引入事件驱动和更细粒度的流程治理。

**Tech Stack:** Spring Boot 2.7、MyBatis-Plus、MySQL、Redis、React 19、Vite、Ant Design、JWT、HTTP API

---

## Scope

本计划只覆盖“接入一期”：

- 平台统一登录与项目上下文
- 子系统项目映射
- 子系统状态回传
- 前端进入平台壳
- 报告与评估结果可被平台读取

不覆盖：

- 投标/合同实施
- EPC/EMC 商务逻辑
- 二期事件总线
- 三期主表彻底重构

## File Structure

### Parent Workspace

- Create: `docs/superpowers/specs/2026-04-14-hvac-research-module-platform-integration-design.md`
- Create: `docs/superpowers/plans/2026-04-14-hvac-research-module-platform-integration.md`

### Backend Repo

- Modify: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/main/entity/ProjectBasicInfo.java`
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/entity/PlatformProjectMapping.java`
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/dto/PlatformProjectCreateDTO.java`
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/dto/PlatformProjectUpdateDTO.java`
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/vo/PlatformProjectStatusVO.java`
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/controller/PlatformProjectIntegrationController.java`
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/service/IPlatformProjectIntegrationService.java`
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/service/impl/PlatformProjectIntegrationServiceImpl.java`
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/resources/mapper/PlatformProjectMappingMapper.xml`
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/test/java/com/enesource/hvac/integration/PlatformProjectIntegrationControllerTest.java`

### Frontend Repo

- Modify: `ui-sichuan-agent/src/App.tsx`
- Modify: `ui-sichuan-agent/src/components/layout/leftBar/leftBar.tsx`
- Modify: `ui-sichuan-agent/src/components/routerGuard/index.tsx`
- Create: `ui-sichuan-agent/src/integration/platformContext.ts`
- Create: `ui-sichuan-agent/src/integration/platformApi.ts`
- Modify: `ui-sichuan-agent/src/pages/projects/index.tsx`
- Modify: `ui-sichuan-agent/src/pages/projectDetail/index.tsx`
- Modify: `ui-sichuan-agent/src/pages/projects/dataCollection.tsx`
- Modify: `ui-sichuan-agent/src/pages/energyEfficiency/evaluate/evaluate.tsx`
- Modify: `ui-sichuan-agent/src/pages/planGeneration/new/index.tsx`

### Database

- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/docs/sql/2026-04-14-platform-project-mapping.sql`

## Task 1: Freeze integration contract

**Files:**
- Create: `docs/superpowers/specs/2026-04-14-hvac-research-module-platform-integration-design.md`
- Create: `docs/superpowers/plans/2026-04-14-hvac-research-module-platform-integration.md`

- [ ] **Step 1: Review the approved integration scope**

Read:

- `docs/superpowers/specs/2026-04-14-hvac-research-module-platform-integration-design.md`

Expected:

- 明确一期只做“统一入口 + 项目映射 + 状态同步”

- [ ] **Step 2: Confirm current subsystem boundaries**

Read:

- `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/main/entity/ProjectBasicInfo.java`
- `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/main/controller/ProjectBasicInfoController.java`
- `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/main/controller/EnergyEfficiencyEvaluationController.java`
- `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/main/controller/SchemeReportController.java`
- `ui-sichuan-agent/src/App.tsx`

Expected:

- 明确现有系统是独立子系统，不是平台主干

- [ ] **Step 3: Commit the approved docs**

Run:

`git add docs/superpowers/specs/2026-04-14-hvac-research-module-platform-integration-design.md docs/superpowers/plans/2026-04-14-hvac-research-module-platform-integration.md`

Expected:

- 两份文档进入暂存区

- [ ] **Step 4: Commit**

Run:

`git commit -m "docs: add hvac research module integration design and plan"`

Expected:

- 本地生成文档提交

## Task 2: Add backend project mapping layer

**Files:**
- Modify: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/main/entity/ProjectBasicInfo.java`
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/entity/PlatformProjectMapping.java`
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/docs/sql/2026-04-14-platform-project-mapping.sql`
- Test: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/test/java/com/enesource/hvac/integration/PlatformProjectIntegrationControllerTest.java`

- [ ] **Step 1: Write the failing backend test**

```java
@SpringBootTest
@AutoConfigureMockMvc
class PlatformProjectIntegrationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void should_create_mapping_when_platform_creates_research_project() throws Exception {
        String body = "{\n" +
                "  \"platformProjectId\": \"FP-2026-0001\",\n" +
                "  \"enterpriseId\": \"ENT-001\",\n" +
                "  \"siteId\": \"SITE-001\",\n" +
                "  \"projectName\": \"四川某工厂中央空调节能项目\",\n" +
                "  \"projectAddress\": \"成都市高新区xxx路\",\n" +
                "  \"coolingStationQuantity\": 2\n" +
                "}";

        mockMvc.perform(post("/integration/platform/projects")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value("1"))
            .andExpect(jsonPath("$.data.platformProjectId").value("FP-2026-0001"));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

`mvn -Dtest=PlatformProjectIntegrationControllerTest test`

Expected:

- FAIL，因为 `/integration/platform/projects` 尚不存在

- [ ] **Step 3: Add minimal mapping table DDL**

```sql
create table if not exists t_platform_project_mapping (
  id bigint primary key auto_increment,
  platform_project_id varchar(64) not null unique,
  research_project_id bigint not null,
  enterprise_id varchar(64) not null,
  site_id varchar(64) not null,
  sync_version int not null default 1,
  lock_status tinyint not null default 0,
  create_time datetime not null default current_timestamp,
  update_time datetime not null default current_timestamp on update current_timestamp
);
```

- [ ] **Step 4: Implement minimal entity and controller**

```java
@Data
@TableName("t_platform_project_mapping")
public class PlatformProjectMapping {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String platformProjectId;
    private Long researchProjectId;
    private String enterpriseId;
    private String siteId;
    private Integer syncVersion;
    private Integer lockStatus;
}
```

```java
@RestController
@RequestMapping("/integration/platform/projects")
public class PlatformProjectIntegrationController {

    private final IPlatformProjectIntegrationService integrationService;

    public PlatformProjectIntegrationController(IPlatformProjectIntegrationService integrationService) {
        this.integrationService = integrationService;
    }

    @PostMapping
    public ResultData<PlatformProjectStatusVO> create(@RequestBody PlatformProjectCreateDTO dto) {
        return ResultData.ok(integrationService.createFromPlatform(dto));
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

`mvn -Dtest=PlatformProjectIntegrationControllerTest test`

Expected:

- PASS

- [ ] **Step 6: Commit**

Run:

`git add hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/docs/sql/2026-04-14-platform-project-mapping.sql hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/test/java/com/enesource/hvac/integration/PlatformProjectIntegrationControllerTest.java`

`git commit -m "feat: add platform project mapping integration api"`

## Task 3: Return platform-readable status summary

**Files:**
- Create: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/vo/PlatformProjectStatusVO.java`
- Modify: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/service/impl/PlatformProjectIntegrationServiceImpl.java`
- Test: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/test/java/com/enesource/hvac/integration/PlatformProjectIntegrationControllerTest.java`

- [ ] **Step 1: Extend failing test for status endpoint**

```java
@Test
void should_return_platform_status_summary() throws Exception {
    mockMvc.perform(get("/integration/platform/projects/FP-2026-0001/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value("1"))
        .andExpect(jsonPath("$.data.researchStatus").exists())
        .andExpect(jsonPath("$.data.schemeGenerated").exists());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

`mvn -Dtest=PlatformProjectIntegrationControllerTest test`

Expected:

- FAIL，因为状态接口尚不存在

- [ ] **Step 3: Implement status summary VO and query**

```java
@Data
public class PlatformProjectStatusVO {
    private String platformProjectId;
    private Long researchProjectId;
    private String researchStatus;
    private Boolean collectionComplete;
    private Boolean reviewComplete;
    private Boolean evaluationSubmitted;
    private Boolean schemeGenerated;
}
```

```java
@GetMapping("/{platformProjectId}/status")
public ResultData<PlatformProjectStatusVO> status(@PathVariable String platformProjectId) {
    return ResultData.ok(integrationService.getStatus(platformProjectId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

`mvn -Dtest=PlatformProjectIntegrationControllerTest test`

Expected:

- PASS

- [ ] **Step 5: Commit**

Run:

`git add hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration`

`git commit -m "feat: add platform-readable research status summary"`

## Task 4: Decouple frontend from standalone login shell

**Files:**
- Modify: `ui-sichuan-agent/src/App.tsx`
- Modify: `ui-sichuan-agent/src/components/layout/leftBar/leftBar.tsx`
- Modify: `ui-sichuan-agent/src/components/routerGuard/index.tsx`
- Create: `ui-sichuan-agent/src/integration/platformContext.ts`

- [ ] **Step 1: Write the failing frontend smoke test note**

Manual expectation:

- 通过平台传入 token 与项目上下文后，前端无需进入自身 `/login`

Run:

`npm run build`

Expected:

- 当前仍构建为独立应用，但尚未支持平台注入模式

- [ ] **Step 2: Add platform context helper**

```ts
export interface PlatformContext {
  token: string;
  platformProjectId?: string;
  enterpriseId?: string;
  siteId?: string;
}

export function getPlatformContext(): PlatformContext | null {
  const raw = window.sessionStorage.getItem("platform_context");
  return raw ? JSON.parse(raw) : null;
}
```

- [ ] **Step 3: Patch router guard to allow platform token mode**

```ts
const context = getPlatformContext();
const token = context?.token || Storage.get("token", true);
if (!token) {
  navigate("/login", { replace: true });
}
```

- [ ] **Step 4: Hide standalone left menu when embedded**

```ts
const platformContext = getPlatformContext();
if (platformContext) {
  return null;
}
```

- [ ] **Step 5: Run build to verify it passes**

Run:

`npm run build`

Expected:

- PASS

- [ ] **Step 6: Commit**

Run:

`git add ui-sichuan-agent/src/App.tsx ui-sichuan-agent/src/components/layout/leftBar/leftBar.tsx ui-sichuan-agent/src/components/routerGuard/index.tsx ui-sichuan-agent/src/integration/platformContext.ts`

`git commit -m "feat: support embedded platform auth context"`

## Task 5: Bind business pages to platform project context

**Files:**
- Modify: `ui-sichuan-agent/src/pages/projects/index.tsx`
- Modify: `ui-sichuan-agent/src/pages/projectDetail/index.tsx`
- Modify: `ui-sichuan-agent/src/pages/projects/dataCollection.tsx`
- Modify: `ui-sichuan-agent/src/pages/energyEfficiency/evaluate/evaluate.tsx`
- Modify: `ui-sichuan-agent/src/pages/planGeneration/new/index.tsx`
- Create: `ui-sichuan-agent/src/integration/platformApi.ts`

- [ ] **Step 1: Write the failing business scenario**

Scenario:

- 平台从正式项目详情页带 `platformProjectId`
- 子系统自动解析映射后的 `researchProjectId`
- 各页面继续使用现有内部流程

Run:

`npm run build`

Expected:

- 当前页面只能依赖自身 `id` 查询参数

- [ ] **Step 2: Add platform API adapter**

```ts
import request from "@/utils/fetch";

export const platformApi = {
  getProjectStatus: (platformProjectId: string) =>
    request.get(`/integration/platform/projects/${platformProjectId}/status`)
};
```

- [ ] **Step 3: Resolve research project id before page loading**

```ts
const platformContext = getPlatformContext();
const projectId = searchParams.get("id") || platformContext?.platformProjectId;
```

```ts
useEffect(() => {
  if (platformContext?.platformProjectId) {
    platformApi.getProjectStatus(platformContext.platformProjectId).then((res) => {
      setResolvedProjectId(res.data.researchProjectId);
    });
  }
}, []);
```

- [ ] **Step 4: Run build to verify it passes**

Run:

`npm run build`

Expected:

- PASS

- [ ] **Step 5: Commit**

Run:

`git add ui-sichuan-agent/src/pages/projects/index.tsx ui-sichuan-agent/src/pages/projectDetail/index.tsx ui-sichuan-agent/src/pages/projects/dataCollection.tsx ui-sichuan-agent/src/pages/energyEfficiency/evaluate/evaluate.tsx ui-sichuan-agent/src/pages/planGeneration/new/index.tsx ui-sichuan-agent/src/integration/platformApi.ts`

`git commit -m "feat: support platform project context mapping"`

## Task 6: Expose platform-consumable summaries and reports

**Files:**
- Modify: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/controller/PlatformProjectIntegrationController.java`
- Modify: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration/service/impl/PlatformProjectIntegrationServiceImpl.java`
- Test: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/test/java/com/enesource/hvac/integration/PlatformProjectIntegrationControllerTest.java`

- [ ] **Step 1: Extend failing test for summary and reports**

```java
@Test
void should_return_platform_summary_and_reports() throws Exception {
    mockMvc.perform(get("/integration/platform/projects/FP-2026-0001/summary"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.evaluationSubmitted").exists());

    mockMvc.perform(get("/integration/platform/projects/FP-2026-0001/reports"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data").isArray());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

`mvn -Dtest=PlatformProjectIntegrationControllerTest test`

Expected:

- FAIL，因为 summary/reports 接口尚不存在

- [ ] **Step 3: Implement the two endpoints**

```java
@GetMapping("/{platformProjectId}/summary")
public ResultData<PlatformProjectStatusVO> summary(@PathVariable String platformProjectId) {
    return ResultData.ok(integrationService.getStatus(platformProjectId));
}

@GetMapping("/{platformProjectId}/reports")
public ResultData<List<SchemeReportVO>> reports(@PathVariable String platformProjectId) {
    return ResultData.ok(integrationService.getReports(platformProjectId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

`mvn -Dtest=PlatformProjectIntegrationControllerTest test`

Expected:

- PASS

- [ ] **Step 5: Commit**

Run:

`git add hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/main/java/com/enesource/hvac/integration hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/src/test/java/com/enesource/hvac/integration/PlatformProjectIntegrationControllerTest.java`

`git commit -m "feat: expose research summary and reports for platform"`

## Task 7: Verification and release packaging

**Files:**
- Modify: `hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/README.md`
- Modify: `ui-sichuan-agent/README.md`

- [ ] **Step 1: Document embedded startup mode**

Add to backend README:

```md
## Platform Integration

- Base path: `/hvac`
- Integration API prefix: `/integration/platform/projects`
- Requires platform-issued token or trusted gateway forwarding
```

Add to frontend README:

```md
## Embedded Mode

- Host platform writes `platform_context` into `sessionStorage`
- App reads token and `platformProjectId` from that context
- Standalone login remains for local debugging only
```

- [ ] **Step 2: Run backend targeted verification**

Run:

`mvn -Dtest=PlatformProjectIntegrationControllerTest test`

Expected:

- PASS

- [ ] **Step 3: Run frontend targeted verification**

Run:

`npm run build`

Expected:

- PASS

- [ ] **Step 4: Commit**

Run:

`git add hvac-energy-saving-cal-dev/hvac-energy-saving-cal-dev/README.md ui-sichuan-agent/README.md`

`git commit -m "docs: describe embedded integration mode"`

- [ ] **Step 5: Push**

Run:

`git push -u origin main`

Expected:

- 文档、接入代码与计划推送到 GitHub 仓库

## Spec Coverage Check

- 平台主干与子系统边界：Task 1
- 项目映射与主键衔接：Task 2
- 平台可读状态：Task 3
- 前端平台壳接入：Task 4
- 项目上下文贯通：Task 5
- 报告摘要回挂：Task 6
- 文档与交付验证：Task 7

## Placeholder Scan

- 本计划未使用 TBD/TODO
- 每个任务均包含具体文件、命令、预期结果
- 所有核心改造点均给出明确落点

## Type Consistency

- 平台主键统一使用 `platformProjectId`
- 子系统内部主键统一使用 `researchProjectId`
- 平台状态统一使用 `PlatformProjectStatusVO`
