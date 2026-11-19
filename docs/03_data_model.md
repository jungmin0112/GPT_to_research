# 데이터 모델 — 데이터 정합성 중심 명세

## 핵심 구분

- **원본(Raw)**: 파일, 검색 결과 메타데이터, 원문 추출, 채팅 메시지, 원문상 위치.
- **분석 기록(ResearchRecord)**: AI가 정리한 관찰/주장/근거/키워드와 질문.
- **결과물(KnowledgeNode)**: 자료조사에서 정리되어 자동 채택된 통합 지식, 프로젝트별 독립.
- **관계(Edge)**: 분기·출처/근거·주제 연관·참조 등. 시각화/검색에 재사용.
- **검토(Review)**: 충돌, 가공 내용 수정 및 이력.

## 테이블 제안

| 엔터티 | 주요 필드 | 제약·관계 |
|---|---|---|
| `projects` | id, owner_id, name, purpose, created_at | 단일 사용자가 여러 프로젝트 소유 |
| `sessions` | id, project_id, owner_id, kind(main/deep/mini), parent_session_id, origin_message_id, source_id, title, status, model_override, reasoning_override, reference_policy, openai_state, created_at | 같은 프로젝트 내 부모를 가짐, 미니는 source_id 필수 |
| `messages` | id, owner_id, project_id, session_id, seq, role(user/assistant/tool), content, status, response_id, created_at, usage_json | `(session_id,seq)` unique; 원본 불변 |
| `sources` | id, owner_id, canonical_url, storage_path, content_hash, title, author, published_at, metadata, extraction_status, created_at | 사용자 전체에서 재사용 가능; 링크만 있어도 기록 |
| `project_sources` | id, owner_id, project_id, source_id, discovered_in_session_id, discovered_by, relevance_score | 프로젝트에 자료 연결, 고유 `(project_id,source_id)` |
| `source_chunks` | id, owner_id, source_id, text, locator_json, text_hash, ordinal, extraction_quality | 원문 내 위치(페이지/문단/오프셋) 추적 |
| `reading_states` | id, owner_id, session_id, source_id, read_status, selected_locator, finished_at | 원문별 읽기·미니 상태, 같은 원문 재열람 가능 |
| `research_records` | id, owner_id, project_id, session_id, source_id, record_type, body, keywords, review_status, created_at | 가설/질문/근거와 최종 정보 구분 |
| `record_evidence` | id, owner_id, record_id, message_id, source_chunk_id, locator_json | 근거 원본 링크, 한 레코드에 여러 근거 가능 |
| `knowledge_nodes` | id, owner_id, project_id, parent_id, title, canonical_body, abstract, status, revision, created_at, updated_at | 프로젝트별 결과물 독립, 부모는 같은 프로젝트 |
| `knowledge_evidence` | id, owner_id, node_id, record_id, source_chunk_id, message_id, session_id, support_type | 지식의 개별 주장/근거/기여 연결 |
| `knowledge_revisions` | id, owner_id, node_id, revision, previous_body, new_body, change_reason, job_id, created_at | 모든 자동·수동 개정 이력 |
| `contributions` | id, owner_id, node_id, session_id, raw_score, share_pct, rationale, evidence_ids_json, calculated_at | 점유율 합은 표시상 오차 허용, 0일 때 미산정 |
| `graph_edges` | id, owner_id, project_id, from_kind, from_id, to_kind, to_id, relation_type, generated_by, confidence, evidence_json, status | 같은 프로젝트의 일반 간선, 관계별 표시 필터 |
| `cross_project_refs` | id, owner_id, from_project_id, from_node_id, to_project_id, to_node_id, relation_type | 타 프로젝트는 복제 없이 참조. 대상 소유권 검사 |
| `message_references` | id, owner_id, message_id, ref_kind, ref_id, locator_json, provenance, explicitly_pinned | 실제 GPT 입력/인용 내역의 감사 흔적 |
| `workspace_states` | id, owner_id, session_id, open_tabs_json, split_json, active_tab_id, scroll_json, panel_tab, draft, updated_at | 세션별 UI 복원, 데이터 지식과 분리 |
| `update_state` | id, owner_id, next_due_at, last_completed_at, interval_seconds, activity_score, enabled | 사용자당 중앙 스케줄 관리 |
| `session_update_state` | id, owner_id, session_id, last_analyzed_seq, pending_count, priority_score, updated_at | 세션별 증분 커서/우선순위 |
| `update_jobs` | id, owner_id, idempotency_key, trigger, status, attempts, lease_until, checkpoint_json, errors_json, created_at, finished_at | 자동·수동 중복 분석 방지 |
| `conflict_reviews` | id, owner_id, project_id, node_id, existing_claim, incoming_claim, diff_spans_json, shared_review_text, evidence_refs_json, status, resolution, resolved_at, job_id | 알림/관리 공통 단일 검토 원본 |
| `notifications` | id, owner_id, type, review_id, message, read_at, created_at | 충돌/실패 등 안내 |
| `usage_events` | id, owner_id, kind, model, tokens_in, tokens_out, estimated_cost, job_id, message_id, created_at | 실제 청구 금액으로 오해하지 않도록 추정 표시 |

### 실행 시점에 보완할 무결성 체크

- 소유권: 모든 사용자 데이터 테이블에 `owner_id`; RLS `auth.uid()=owner_id`. **하위 FK가 실제 상위 행의 프로젝트·소유권과 일치하도록** 복합 FK 또는 트리거 검증.
- 세션 부모와 지식 부모는 같은 프로젝트; 자기참조·순환 금지. 깊이 제한 없음.
- 임의 타입의 `graph_edges`는 FK가 깨질 수 있으므로 허용 타입에 대해 대상 실재 및 소유권 검증 함수/트리거를 도입하거나 연결 유형별 테이블로 분리.
- 원문 중복은 `canonical_url`, `content_hash`를 참고하되 URL이 같은 최신 개정은 다른 버전으로 처리할 수 있어야 한다.
- 지식 노드 개정은 `revision` 정수 증가와 낙관적 락; AI 동시 실행이 이전 개정을 덮어쓰지 않음.
- 연구 결과가 AI 분석으로 채택되었는지·출처가 무엇인지 항상 감사 가능.
- `cross_project_refs`는 읽기 참조 링크이며 양쪽 결과물의 독립성을 해치지 않음.
- 실제 DB SQL은 Codex가 마이그레이션으로 작성하고 RLS 검증 테스트를 수행. 이 문서는 스키마 **명세**이며 현재 실행 SQL은 없음.

## 핵심 데이터 흐름

1. 사용자 질문 -> `messages` 원본 저장 -> API 답변·인용 저장.
2. 원문 발견 -> `sources`/`project_sources` 메타데이터 저장 -> 추출 성공 시 `source_chunks`.
3. 독해 완료 -> `reading_states` 업데이트 -> `research_records` + `record_evidence` 생성.
4. 자동 갱신 -> `session_update_state` 이후 미처리 데이터만 읽기 -> 기존 지식 검색 -> 정상 정보 통합 또는 conflict.
5. 지식 노드 생성/개정 -> `knowledge_evidence`/`knowledge_revisions` -> `contributions` 재산정 -> `graph_edges` 갱신.
6. 결과물 클릭 -> 본문·근거·점유율 표시 -> 연결 `session_id`로 바로 이동.

## 정보 보존 전략

- 원본 삭제 요청이 없는 한 메시지와 사용자 파일 원본을 요약 때문에 삭제하지 않는다.
- AI 가공 내용은 언제든 수정 가능; 자동 수정 시 이전 버전 기록 필수.
- 외부 자료는 저작권/사이트 정책에 따라 메타데이터·URL만 보관할 수 있고, 확보하지 않은 본문을 저장한 것처럼 표시하지 않는다.
