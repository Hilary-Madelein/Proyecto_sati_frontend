/** Severidad mínima que elige un suscriptor (las que generan alertas). */
export type MinSeverity = "critical" | "high";

/** Cuenta de administración (GET /admin/auth/me, GET /admin/users). */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  /** Contraseña temporal: debe cambiarla antes de usar el panel. */
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Respuesta de POST /admin/auth/login. */
export interface LoginResponse {
  token: string;
  expiresAt: string;
  admin: AdminUser;
}

/** Suscriptor de alertas por correo (GET /notifications/subscribers). */
export interface Subscriber {
  id: string;
  name: string;
  email: string;
  /** Vacío = todo el país. */
  provinces: string[];
  minSeverity: MinSeverity;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryStatus = "sent" | "failed";

/** Un envío del historial (GET /notifications/deliveries). */
export interface Delivery {
  id: string;
  alertKey: string;
  eventId: string | null;
  subscriberId: string | null;
  recipient: string;
  channel: string;
  subject: string;
  status: DeliveryStatus;
  error: string | null;
  createdAt: string;
}

export interface DeliveriesPage {
  items: Delivery[];
  total: number;
}

/** GET /notifications/summary */
export interface NotificationsSummary {
  subscribers: { total: number; active: number };
  deliveries: { days: number; sent: number; failed: number };
  /** false = el backend no tiene SMTP: los correos solo van a su log. */
  emailConfigured: boolean;
}

/** Lo escrito en un formulario, para no perderlo si algo falla. */
export type FormValues = Record<string, string | boolean>;

/** Resultado de una Server Action del panel, para mostrar en el formulario. */
export type ActionState =
  | {
      ok: boolean;
      message: string;
      errors?: Partial<Record<string, string>>;
      /**
       * React 19 limpia el formulario al terminar la acción: si falló, se
       * devuelve lo escrito (nunca contraseñas) para volver a mostrarlo.
       */
      values?: FormValues;
    }
  | undefined;
