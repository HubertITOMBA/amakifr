import { describe, expect, it } from "vitest";
import type { NotificationDto } from "@/lib/services/notifications/types";
import { mapNotificationDtoForWebAction } from "@/lib/services/notifications/map-notification-for-web";

describe("mapNotificationDtoForWebAction", () => {
  it("restitue createdAt en Date (contrat Web historique getNotifications)", () => {
    const dto: NotificationDto = {
      id: "n-1",
      userId: "user-1",
      type: "Systeme",
      titre: "Titre",
      message: "Message",
      lien: null,
      lue: false,
      createdAt: "2024-06-01T12:00:00.000Z",
    };

    const web = mapNotificationDtoForWebAction(dto);

    expect(web.createdAt).toBeInstanceOf(Date);
    expect(web.createdAt.toISOString()).toBe("2024-06-01T12:00:00.000Z");
    expect(web.id).toBe("n-1");
    expect(web.userId).toBe("user-1");
  });

  it("ne modifie pas les autres champs du DTO", () => {
    const dto: NotificationDto = {
      id: "n-2",
      userId: "user-2",
      type: "Email",
      titre: "A",
      message: "B",
      lien: "/x",
      lue: true,
      createdAt: "2025-01-15T08:30:00.000Z",
    };

    const web = mapNotificationDtoForWebAction(dto);
    expect(web).toMatchObject({
      id: "n-2",
      userId: "user-2",
      type: "Email",
      titre: "A",
      message: "B",
      lien: "/x",
      lue: true,
    });
  });
});
