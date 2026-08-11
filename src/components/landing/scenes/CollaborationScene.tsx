import { Bookmark, CheckCircle2, Edit3, FileText, Paperclip, Pin, Search, Send, Smile, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ProductFrame } from "./ProductFrame";

export function CollaborationScene() {
  const { t } = useI18n();

  return (
    <ProductFrame title={t("chat.title")} className="collaboration-scene">
      <div className="collaboration-scene__layout">
        <aside className="chat-list">
          <div className="chat-list__search-row"><div className="chat-list__search"><Search /><span>{t("landing.chat.search")}</span></div><button type="button" tabIndex={-1}><Edit3 /></button><button type="button" tabIndex={-1}><Users /></button></div>
          <ChatListItem initials="TF" persona="team" title={t("chat.generalChat")} preview={t("landing.chat.previewGeneral")} active />
          <p className="chat-list__label">{t("chat.directMessages")}</p>
          <ChatListItem initials="AK" persona="alex" title="Алексей Ким" preview={t("landing.chat.previewDirect")} />
          <ChatListItem initials="MS" persona="maria" title="Мария Соколова" preview={t("landing.chat.previewFile")} />
          <ChatListItem initials="OR" persona="orion" title={t("landing.preview.projectOrion")} preview={t("landing.chat.previewProject")} />
        </aside>

        <div className="chat-thread">
          <div className="chat-thread__header">
            <div><Avatar initials="TF" persona="team" /><span><strong>{t("chat.generalChat")}</strong></span></div>
            <div><Bookmark /><Edit3 /><Pin /></div>
          </div>
          <div className="chat-thread__messages">
            <Message initials="AK" persona="alex" name="Алексей Ким" time="10:24" text={t("landing.chat.messageOne")} own />
            <div className="chat-typing"><Avatar initials="MS" persona="maria" /><div><i /><i /><i /></div><small>{t("landing.chat.typing")}</small></div>
            <Message initials="MS" persona="maria" name="Мария Соколова" time="10:27" text={t("landing.chat.messageTwo")} reaction="👍 4" />
            <div className="chat-task-link">
              <CheckCircle2 />
              <span><small>TF-141 · {t("board.review")}</small><strong>{t("landing.preview.taskKanbanResponsive")}</strong></span>
              <Avatar initials="DP" persona="daria" />
            </div>
            <div className="chat-file-message">
              <Avatar initials="IV" persona="ivan" />
              <div><strong>Иван Воронов <small>10:31</small></strong><div className="chat-attachment"><FileText /><span><b>release-brief.pdf</b><small>2.4 MB</small></span></div></div>
            </div>
            <Message initials="EK" persona="elena" name="Елена Крылова" time="10:36" text={t("landing.chat.messageThree")} />
          </div>
          <div className="chat-composer"><Paperclip /><span className="chat-composer__placeholder">{t("landing.chat.composer")}</span><span className="chat-composer__draft">{t("landing.chat.messageOne")}</span><Smile /><button type="button" tabIndex={-1} aria-hidden><Send /></button></div>
        </div>

        <aside className="chat-pins">
          <div className="chat-pins__heading"><Bookmark />{t("chat.pinnedMessages")}</div>
          <div className="chat-pin-card"><strong>Алексей Ким <small>09:48</small></strong><p>{t("landing.chat.pinnedMessage")}</p><span>{t("chat.pinnedBy")}: Мария</span></div>
          <div className="chat-pin-card"><strong>Елена Крылова <small>10:36</small></strong><p>{t("landing.chat.messageThree")}</p><span>release-brief.pdf</span></div>
        </aside>
      </div>
    </ProductFrame>
  );
}

type Persona = "team" | "alex" | "maria" | "orion" | "daria" | "ivan" | "elena";

function Avatar({ initials, persona }: { initials: string; persona: Persona }) {
  return <span className={`chat-avatar chat-avatar--${persona}`} aria-label={initials}><span aria-hidden>{persona === "alex" ? "👨🏻‍💻" : persona === "maria" ? "👩🏼‍💻" : persona === "daria" ? "👩🏽‍🎨" : persona === "ivan" ? "🧑🏻‍💻" : persona === "elena" ? "👩🏻‍🔬" : initials}</span></span>;
}

function ChatListItem({ initials, persona, title, preview, active }: { initials: string; persona: Persona; title: string; preview: string; active?: boolean }) {
  return <div className={active ? "chat-list-item is-active" : "chat-list-item"}><Avatar initials={initials} persona={persona} /><span><strong>{title}</strong><small>{preview}</small></span></div>;
}

function Message({ initials, persona, name, time, text, reaction, own }: { initials: string; persona: Persona; name: string; time: string; text: string; reaction?: string; own?: boolean }) {
  return <div className={own ? "chat-message is-own" : "chat-message"}><Avatar initials={initials} persona={persona} /><div><strong>{name} <small>{time}</small></strong><p>{text}</p>{reaction && <span className="chat-reaction">{reaction}</span>}</div></div>;
}
