(() => {
  const registry = (globalThis.RehearsalExtractors ??= {});

  function cleanText(value, maximumLength) {
    return typeof value === "string"
      ? value.trim().replace(/\s+/g, " ").slice(0, maximumLength)
      : "";
  }

  function messageIdentifier(documentValue) {
    const thread = documentValue.querySelector("[data-thread-perm-id]");
    const message = documentValue.querySelector("[data-message-id]");
    return cleanText(
      thread?.getAttribute("data-thread-perm-id") ??
        message?.getAttribute("data-message-id") ??
        "",
      160,
    );
  }

  function senderMetadata(documentValue) {
    const sender = documentValue.querySelector("[data-message-id] [email]");
    const address = cleanText(sender?.getAttribute("email") ?? "", 320);
    const displayName = cleanText(
      sender?.getAttribute("name") ?? sender?.textContent ?? address,
      160,
    );
    return { address, displayName };
  }

  registry.gmail = {
    matches(hostname) {
      return hostname === "mail.google.com";
    },
    inspect(context) {
      const identifier = messageIdentifier(context.document);
      if (
        identifier.length === 0 ||
        context.state.lastGmailMessageId === identifier
      ) {
        return [];
      }

      const heading = context.document.querySelector(
        "h2[data-thread-perm-id], h2[role='heading']",
      );
      const subject = cleanText(heading?.textContent ?? "", 300);
      if (subject.length === 0) {
        return [];
      }

      const sender = senderMetadata(context.document);
      context.state.lastGmailMessageId = identifier;
      return [
        {
          sourceApplication: "mail",
          action: "read_report",
          intent: "Read a support report",
          payload: {
            messageId: identifier,
            subject,
            ...(sender.displayName.length === 0
              ? {}
              : { senderName: sender.displayName }),
            ...(sender.address.length === 0
              ? {}
              : { senderAddress: sender.address }),
          },
        },
      ];
    },
  };
})();
