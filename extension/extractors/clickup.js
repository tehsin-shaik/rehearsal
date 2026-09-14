(() => {
  const registry = (globalThis.RehearsalExtractors ??= {});

  function compact(value) {
    return typeof value === "string"
      ? value.trim().replace(/\s+/g, " ").slice(0, 160)
      : "";
  }

  function taskIdentifier(pathname) {
    return /\/t\/([A-Za-z0-9_-]{2,80})(?:\/|$)/.exec(pathname)?.[1] ?? null;
  }

  registry.clickup = {
    matches(hostname) {
      return hostname === "app.clickup.com";
    },
    inspect(context) {
      const target = context.event?.target;
      if (
        context.event?.type === "click" &&
        target instanceof globalThis.Element
      ) {
        const control = target.closest("button, [role='button']");
        const label = compact(
          control?.getAttribute("aria-label") ?? control?.textContent ?? "",
        ).toLowerCase();
        if (
          label === "create task" ||
          label === "new task" ||
          label.startsWith("create task ")
        ) {
          context.state.clickUpCreateIntent = true;
        }
      }

      const identifier = taskIdentifier(context.location.pathname);
      if (
        identifier === null ||
        !context.state.clickUpCreateIntent ||
        context.state.lastClickUpTaskId === identifier
      ) {
        return [];
      }

      context.state.lastClickUpTaskId = identifier;
      return [
        {
          sourceApplication: "issue_tracker",
          action: "create_issue",
          intent: "Create a support issue",
          payload: {
            taskId: identifier,
            confirmed: true,
          },
        },
      ];
    },
  };
})();
