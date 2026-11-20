import React from "react";
import "./Components.css";

export function EmptyState({ icon = "◎", title, description, actionText, onAction }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      {title && <h3 className="empty-state-title">{title}</h3>}
      {description && <p className="empty-state-desc">{description}</p>}
      {actionText && onAction && (
        <button className="empty-state-btn" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
