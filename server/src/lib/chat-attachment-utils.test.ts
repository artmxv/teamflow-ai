import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertProjectsBelongToWorkspace,
  assertTasksBelongToWorkspace,
  buildAttachmentPreviewText,
  buildChatStorageKey,
  canAccessChatAttachmentDownload,
  dedupeIds,
  filterSafeChatStorageKeys,
  isSafeChatStorageKey,
  parseIdListField,
  parseRawIdListField,
  sanitizeChatStoragePathSegment,
  summarizeAttachmentsForPreview,
  validateChatAttachmentFields,
  validateChatMessagePayload,
  validateChatUploadedFile,
  CHAT_MAX_FILE_ATTACHMENTS,
  CHAT_MAX_FILE_BYTES,
} from "./chat-attachment-utils.js";
import { CHAT_MESSAGE_MAX_LENGTH } from "./chat-message-utils.js";
import { mergeChatMessagesById } from "./chat-message-utils.js";
import { canDeleteChatMessage } from "./chat-message-utils.js";

describe("chat attachment field combinations", () => {
  it("accepts valid FILE fields", () => {
    assert.deepEqual(
      validateChatAttachmentFields({
        type: "FILE",
        storageKey: "workspaces/w1/chat/c1/m1/uuid-file.pdf",
        originalName: "file.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        taskId: null,
        projectId: null,
      }),
      { ok: true },
    );
  });

  it("rejects FILE without storageKey or originalName", () => {
    assert.equal(
      validateChatAttachmentFields({
        type: "FILE",
        storageKey: null,
        originalName: "a.pdf",
      }).ok,
      false,
    );
  });

  it("rejects FILE with taskId or projectId", () => {
    assert.equal(
      validateChatAttachmentFields({
        type: "FILE",
        storageKey: "key",
        originalName: "a.pdf",
        taskId: "t1",
      }).ok,
      false,
    );
  });

  it("accepts TASK with only taskId", () => {
    assert.deepEqual(
      validateChatAttachmentFields({
        type: "TASK",
        taskId: "task_1",
      }),
      { ok: true },
    );
  });

  it("rejects TASK with file fields", () => {
    assert.equal(
      validateChatAttachmentFields({
        type: "TASK",
        taskId: "task_1",
        storageKey: "x",
      }).ok,
      false,
    );
  });

  it("accepts PROJECT with only projectId", () => {
    assert.deepEqual(
      validateChatAttachmentFields({
        type: "PROJECT",
        projectId: "project_1",
      }),
      { ok: true },
    );
  });

  it("rejects PROJECT with taskId", () => {
    assert.equal(
      validateChatAttachmentFields({
        type: "PROJECT",
        projectId: "project_1",
        taskId: "task_1",
      }).ok,
      false,
    );
  });
});

describe("chat message payload validation", () => {
  it("keeps text-only messages valid", () => {
    assert.deepEqual(
      validateChatMessagePayload({
        rawContent: "  hello  ",
        maxLength: CHAT_MESSAGE_MAX_LENGTH,
        fileCount: 0,
        taskIds: [],
        projectIds: [],
      }),
      { ok: true, content: "hello" },
    );
  });

  it("rejects empty message with no attachments", () => {
    assert.deepEqual(
      validateChatMessagePayload({
        rawContent: "   ",
        maxLength: CHAT_MESSAGE_MAX_LENGTH,
        fileCount: 0,
        taskIds: [],
        projectIds: [],
      }),
      { ok: false, reason: "empty" },
    );
  });

  it("accepts attachment-only messages", () => {
    assert.deepEqual(
      validateChatMessagePayload({
        rawContent: "",
        maxLength: CHAT_MESSAGE_MAX_LENGTH,
        fileCount: 0,
        taskIds: ["task_1"],
        projectIds: [],
      }),
      { ok: true, content: "" },
    );
  });

  it("rejects more than max files", () => {
    assert.deepEqual(
      validateChatMessagePayload({
        rawContent: "hi",
        maxLength: CHAT_MESSAGE_MAX_LENGTH,
        fileCount: CHAT_MAX_FILE_ATTACHMENTS + 1,
        taskIds: [],
        projectIds: [],
      }),
      { ok: false, reason: "too_many_files" },
    );
  });

  it("rejects duplicate task ids", () => {
    assert.deepEqual(
      validateChatMessagePayload({
        rawContent: "",
        maxLength: CHAT_MESSAGE_MAX_LENGTH,
        fileCount: 0,
        taskIds: ["task_1", "task_1"],
        projectIds: [],
      }),
      { ok: false, reason: "duplicate_entity" },
    );
  });

  it("rejects duplicate project ids", () => {
    assert.deepEqual(
      validateChatMessagePayload({
        rawContent: "",
        maxLength: CHAT_MESSAGE_MAX_LENGTH,
        fileCount: 0,
        taskIds: [],
        projectIds: ["project_1", "project_1"],
      }),
      { ok: false, reason: "duplicate_entity" },
    );
  });
});

describe("chat uploaded file validation", () => {
  it("rejects zero-byte files", () => {
    assert.deepEqual(
      validateChatUploadedFile({
        originalname: "doc.pdf",
        mimetype: "application/pdf",
        size: 0,
      }),
      { ok: false, reason: "empty_file" },
    );
  });

  it("rejects oversized files", () => {
    assert.deepEqual(
      validateChatUploadedFile({
        originalname: "doc.pdf",
        mimetype: "application/pdf",
        size: CHAT_MAX_FILE_BYTES + 1,
      }),
      { ok: false, reason: "too_large" },
    );
  });

  it("accepts allowed files under the size limit", () => {
    const result = validateChatUploadedFile({
      originalname: "photo.png",
      mimetype: "image/png",
      size: 1024,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.originalName, "photo.png");
      assert.equal(result.sizeBytes, 1024);
    }
  });
});

describe("filename and path sanitization", () => {
  it("sanitizes path segments", () => {
    assert.equal(sanitizeChatStoragePathSegment("../etc/passwd"), "passwd");
    assert.equal(sanitizeChatStoragePathSegment("My Report!.pdf"), "My_Report_");
  });

  it("builds workspace-scoped chat storage keys", () => {
    const key = buildChatStorageKey({
      workspaceId: "ws1",
      conversationId: "conv1",
      messageId: "msg1",
      originalName: "Report 2026.pdf",
    });
    assert.match(key, /^workspaces\/ws1\/chat\/conv1\/msg1\/.+\.pdf$/);
    assert.ok(!key.includes(" "));
  });

  it("validates safe storage keys under the intended prefix", () => {
    assert.equal(
      isSafeChatStorageKey({
        storageKey: "workspaces/ws1/chat/conv1/msg1/uuid-file.pdf",
        workspaceId: "ws1",
        conversationId: "conv1",
        messageId: "msg1",
      }),
      true,
    );
    assert.equal(
      isSafeChatStorageKey({
        storageKey: "workspaces/ws1/chat/conv1/msg1/../secret.pdf",
        workspaceId: "ws1",
        conversationId: "conv1",
        messageId: "msg1",
      }),
      false,
    );
    assert.equal(
      isSafeChatStorageKey({
        storageKey: "workspaces/ws1/chat/other-conv/msg1/uuid-file.pdf",
        workspaceId: "ws1",
        conversationId: "conv1",
        messageId: "msg1",
      }),
      false,
    );
    assert.equal(
      isSafeChatStorageKey({
        storageKey: "workspaces/other/chat/conv1/msg1/uuid-file.pdf",
        workspaceId: "ws1",
        conversationId: "conv1",
        messageId: "msg1",
      }),
      false,
    );
  });

  it("filters unsafe storage keys before cleanup", () => {
    const safe = filterSafeChatStorageKeys({
      storageKeys: [
        "workspaces/ws1/chat/conv1/msg1/file.pdf",
        "workspaces/ws1/chat/other/msg1/file.pdf",
        "workspaces/ws1/tasks/task1/file.pdf",
      ],
      workspaceId: "ws1",
      conversationId: "conv1",
      messageId: "msg1",
    });
    assert.deepEqual(safe, ["workspaces/ws1/chat/conv1/msg1/file.pdf"]);
  });
});

describe("chat attachment download storage gate", () => {
  it("rejects cross-prefix storage keys before storage access", () => {
    assert.equal(
      isSafeChatStorageKey({
        storageKey: "workspaces/ws1/chat/other-conv/msg1/file.pdf",
        workspaceId: "ws1",
        conversationId: "conv1",
        messageId: "msg1",
      }),
      false,
    );
  });
});

describe("chat attachment cleanup storage gate", () => {
  it("never includes unsafe storage keys in deletion cleanup", () => {
    const safe = filterSafeChatStorageKeys({
      storageKeys: [
        "workspaces/ws1/chat/conv1/msg1/safe.pdf",
        "workspaces/ws1/chat/other/msg1/unsafe.pdf",
      ],
      workspaceId: "ws1",
      conversationId: "conv1",
      messageId: "msg1",
    });

    assert.deepEqual(safe, ["workspaces/ws1/chat/conv1/msg1/safe.pdf"]);
    assert.equal(safe.includes("workspaces/ws1/chat/other/msg1/unsafe.pdf"), false);
  });
});

describe("entity id helpers", () => {
  it("dedupes task and project ids safely", () => {
    assert.deepEqual(dedupeIds(["a", "a", "b", ""]), ["a", "b"]);
    assert.deepEqual(parseIdListField('["t1","t1","t2"]'), ["t1", "t2"]);
    assert.deepEqual(parseIdListField("p1,p1,p2"), ["p1", "p2"]);
  });

  it("preserves duplicate ids in raw parsing for validation", () => {
    assert.deepEqual(parseRawIdListField('["t1","t1","t2"]'), ["t1", "t1", "t2"]);
    assert.deepEqual(parseRawIdListField("p1,p1,p2"), ["p1", "p1", "p2"]);
  });

  it("rejects cross-workspace tasks", () => {
    assert.equal(
      assertTasksBelongToWorkspace({
        requestedTaskIds: ["t1"],
        foundTasks: [{ id: "t1", workspaceId: "other" }],
        workspaceId: "ws1",
      }),
      "cross_workspace",
    );
  });

  it("rejects missing tasks", () => {
    assert.equal(
      assertTasksBelongToWorkspace({
        requestedTaskIds: ["t1"],
        foundTasks: [],
        workspaceId: "ws1",
      }),
      "missing",
    );
  });

  it("rejects cross-workspace projects", () => {
    assert.equal(
      assertProjectsBelongToWorkspace({
        requestedProjectIds: ["p1"],
        foundProjects: [{ id: "p1", workspaceId: "other" }],
        workspaceId: "ws1",
      }),
      "cross_workspace",
    );
  });
});

describe("download authorization helper", () => {
  it("rejects unauthorized download attempts", () => {
    assert.equal(
      canAccessChatAttachmentDownload({
        isAuthenticated: false,
        isActiveWorkspaceMember: true,
        isConversationMember: true,
        attachmentBelongsToConversation: true,
        attachmentType: "FILE",
        attachmentWorkspaceId: "ws1",
        activeWorkspaceId: "ws1",
      }),
      "unauthenticated",
    );

    assert.equal(
      canAccessChatAttachmentDownload({
        isAuthenticated: true,
        isActiveWorkspaceMember: false,
        isConversationMember: true,
        attachmentBelongsToConversation: true,
        attachmentType: "FILE",
        attachmentWorkspaceId: "ws1",
        activeWorkspaceId: "ws1",
      }),
      "forbidden",
    );

    assert.equal(
      canAccessChatAttachmentDownload({
        isAuthenticated: true,
        isActiveWorkspaceMember: true,
        isConversationMember: true,
        attachmentBelongsToConversation: true,
        attachmentType: "FILE",
        attachmentWorkspaceId: "other",
        activeWorkspaceId: "ws1",
      }),
      "forbidden",
    );

    assert.equal(
      canAccessChatAttachmentDownload({
        isAuthenticated: true,
        isActiveWorkspaceMember: true,
        isConversationMember: false,
        attachmentBelongsToConversation: true,
        attachmentType: "FILE",
        attachmentWorkspaceId: "ws1",
        activeWorkspaceId: "ws1",
      }),
      "forbidden",
    );
  });
});

describe("attachment-only conversation preview", () => {
  it("builds deterministic attachment previews", () => {
    assert.equal(buildAttachmentPreviewText("hello", [{ type: "FILE" }]), "hello");
    assert.equal(buildAttachmentPreviewText("", [{ type: "FILE" }]), "File");
    assert.equal(
      buildAttachmentPreviewText("", [{ type: "FILE" }, { type: "FILE" }]),
      "Files",
    );
    assert.equal(buildAttachmentPreviewText("", [{ type: "TASK" }]), "Task");
    assert.equal(buildAttachmentPreviewText("", [{ type: "PROJECT" }]), "Project");
    assert.equal(
      buildAttachmentPreviewText("", [
        { type: "FILE" },
        { type: "TASK" },
        { type: "PROJECT" },
      ]),
      "File, Task, Project",
    );
    assert.deepEqual(summarizeAttachmentsForPreview([{ type: "FILE" }, { type: "FILE" }]), {
      fileCount: 2,
      taskCount: 0,
      projectCount: 0,
    });
  });
});

describe("realtime merge with attachments", () => {
  it("deduplicates messages that include attachments by id", () => {
    const existing = [
      {
        id: "m1",
        createdAt: "2026-07-22T10:00:00.000Z",
        content: "",
        attachments: [{ type: "FILE" as const }],
      },
    ];
    const incoming = [
      {
        id: "m1",
        createdAt: "2026-07-22T10:00:00.000Z",
        content: "",
        attachments: [
          { type: "FILE" as const },
          { type: "TASK" as const },
        ],
      },
    ];

    const merged = mergeChatMessagesById(existing, incoming);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.attachments.length, 2);
  });
});

describe("message deletion does not imply entity deletion", () => {
  it("only author may delete a message (attachments cascade separately)", () => {
    assert.equal(canDeleteChatMessage("author", "author"), true);
    assert.equal(canDeleteChatMessage("author", "other"), false);
  });
});
