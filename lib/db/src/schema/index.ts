import { pgTable, text, serial, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const servicesTable = pgTable("services", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  copy: text("copy").notNull(),
  timing: text("timing").notNull(),
  price: text("price").notNull(),
  documents: text("documents").notNull(),
  icon: text("icon").notNull(),
  accent: text("accent").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
}, (table) => [
  index("idx_services_active_order").on(table.isActive, table.orderIndex),
  index("idx_services_category").on(table.category),
]);

export const enquiriesTable = pgTable("enquiries", {
  id: serial("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  serviceId: text("service_id").references(() => servicesTable.id),
  applicationStatus: text("application_status").default("New").notNull(),
  amountCharged: integer("amount_charged").default(0).notNull(),
  amountPaid: integer("amount_paid").default(0).notNull(),
  amountPending: integer("amount_pending").default(0).notNull(),
  paymentMethod: text("payment_method").default("Pending"),
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_enquiries_customer_id").on(table.customerId),
  index("idx_enquiries_mobile_number").on(table.mobileNumber),
  index("idx_enquiries_status").on(table.applicationStatus),
  index("idx_enquiries_created_at_desc").on(table.createdAt),
]);

export const chatConversationsTable = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  relatedService: text("related_service"),
  status: text("status").default("New").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => chatConversationsTable.id).notNull(),
  message: text("message").notNull(),
  isAdminReply: boolean("is_admin_reply").default(false).notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_chat_messages_conv_id").on(table.conversationId),
]);

export const recordsTable = pgTable("records", {
  id: serial("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  mobileNumber: text("mobile_number"),
  serviceProvided: text("service_provided").notNull(),
  amountCharged: integer("amount_charged").default(0).notNull(),
  amountPaid: integer("amount_paid").default(0).notNull(),
  amountPending: integer("amount_pending").default(0).notNull(),
  paymentMethod: text("payment_method").default("Cash"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_records_customer_id").on(table.customerId),
  index("idx_records_mobile").on(table.mobileNumber),
  index("idx_records_created_at_desc").on(table.createdAt),
]);

export type ApplicationStep = {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "pending" | "rejected";
  completedAt?: string | null;
  note?: string;
};

export const applicationTasksTable = pgTable("application_tasks", {
  id: serial("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  serviceName: text("service_name").notNull(),
  applyUrl: text("apply_url"),
  applicationNumber: text("application_number"),
  currentStep: text("current_step").default("Application Received").notNull(),
  status: text("status").default("In Progress").notNull(),
  progressPercent: integer("progress_percent").default(20).notNull(),
  steps: jsonb("steps").$type<ApplicationStep[]>().default([]).notNull(),
  priority: text("priority").default("Normal").notNull(),
  targetDate: text("target_date"),
  assignedStaff: text("assigned_staff"),
  paymentType: text("payment_type").default("Cash").notNull(),
  amountPaid: integer("amount_paid").default(0).notNull(),
  amountPending: integer("amount_pending").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_app_tasks_customer_id").on(table.customerId),
  index("idx_app_tasks_mobile_number").on(table.mobileNumber),
  index("idx_app_tasks_status").on(table.status),
  index("idx_app_tasks_created_at_desc").on(table.createdAt),
]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  organization: text("organization"),
  category: text("category").notNull(),
  vacancies: text("vacancies"),
  qualification: text("qualification"),
  ageLimit: text("age_limit"),
  startDate: text("start_date"),
  lastDate: text("last_date"),
  applicationFee: text("application_fee"),
  posterUrl: text("poster_url"),
  attachmentUrl: text("attachment_url"),
  applyUrl: text("apply_url"),
  description: text("description"),
  isFeatured: boolean("is_featured").default(false).notNull(),
  status: text("status").default("Published").notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_notifications_featured").on(table.isFeatured),
  index("idx_notifications_status").on(table.status),
  index("idx_notifications_category").on(table.category),
  index("idx_notifications_created_at_desc").on(table.createdAt),
]);

// Zod schemas
export const insertServiceSchema = createInsertSchema(servicesTable);
export const selectServiceSchema = createSelectSchema(servicesTable);

export const insertEnquirySchema = createInsertSchema(enquiriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectEnquirySchema = createSelectSchema(enquiriesTable);

export const insertChatConversationSchema = createInsertSchema(chatConversationsTable).omit({ id: true, createdAt: true });
export const selectChatConversationSchema = createSelectSchema(chatConversationsTable);

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });
export const selectChatMessageSchema = createSelectSchema(chatMessagesTable);

export const insertRecordSchema = createInsertSchema(recordsTable).omit({ id: true, createdAt: true });
export const selectRecordSchema = createSelectSchema(recordsTable);

export const insertApplicationTaskSchema = createInsertSchema(applicationTasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectApplicationTaskSchema = createSelectSchema(applicationTasksTable);

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectNotificationSchema = createSelectSchema(notificationsTable);

export const reportSettingsTable = pgTable("report_settings", {
  id: text("id").primaryKey().default("daily_report"),
  adminEmail: text("admin_email").default("airnetcomputersbk@gmail.com").notNull(),
  recipientEmail: text("recipient_email").default("rasoolahmed246@gmail.com"),
  autoEnabled: boolean("auto_enabled").default(true).notNull(),
  scheduledTime: text("scheduled_time").default("23:00").notNull(),
  timeZone: text("time_zone").default("Asia/Kolkata").notNull(),
  // Email sending provider: 'gmail_api' | 'smtp'
  emailProvider: text("email_provider").default("gmail_api").notNull(),
  // Gmail OAuth 2.0 Integration fields
  gmailClientId: text("gmail_client_id"),
  gmailClientSecretEncrypted: text("gmail_client_secret_encrypted"),
  gmailRefreshTokenEncrypted: text("gmail_refresh_token_encrypted"),
  gmailAccessTokenEncrypted: text("gmail_access_token_encrypted"),
  gmailTokenExpiry: timestamp("gmail_token_expiry"),
  gmailConnectedEmail: text("gmail_connected_email"),
  gmailConnectionStatus: text("gmail_connection_status").default("Disconnected"),
  gmailLastError: text("gmail_last_error"),
  // Fallback SMTP fields
  smtpHost: text("smtp_host"),
  smtpPort: text("smtp_port").default("587"),
  smtpSecure: boolean("smtp_secure").default(false),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  smtpFromName: text("smtp_from_name").default("Airnet Computers"),
  adminMasterPassword: text("admin_master_password"),
  adminResetOtp: text("admin_reset_otp"),
  adminResetOtpExpiry: timestamp("admin_reset_otp_expiry"),
  adminPasswordUpdatedAt: timestamp("admin_password_updated_at"),
  adminMobileNumber: text("admin_mobile_number").default("+91 7892881086"),
  frontendMobileNumber: text("frontend_mobile_number").default("+91 7892881086"),
  showUpdatedMobileOnFrontend: boolean("show_updated_mobile_on_frontend").default(false).notNull(),
  adminMobileOtp: text("admin_mobile_otp"),
  adminMobileOtpExpiry: timestamp("admin_mobile_otp_expiry"),
  adminMobilePending: text("admin_mobile_pending"),
  lastRunDate: text("last_run_date"),
  lastRunStatus: text("last_run_status"),
  lastRunError: text("last_run_error"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dailyReportLogsTable = pgTable("daily_report_logs", {
  id: serial("id").primaryKey(),
  reportDate: text("report_date").notNull(),
  recipient: text("recipient").notNull(),
  senderEmail: text("sender_email"),
  emailProvider: text("email_provider").default("gmail_api"),
  gmailMessageId: text("gmail_message_id"),
  gmailThreadId: text("gmail_thread_id"),
  deliveryStatus: text("delivery_status").notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  metrics: jsonb("metrics"),
  errorMessage: text("error_message"),
  pdfGenerated: boolean("pdf_generated").default(true).notNull(),
  previewUrl: text("preview_url"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const insertReportSettingsSchema = createInsertSchema(reportSettingsTable);
export const selectReportSettingsSchema = createSelectSchema(reportSettingsTable);
export const insertDailyReportLogSchema = createInsertSchema(dailyReportLogsTable).omit({ id: true, generatedAt: true });
export const selectDailyReportLogSchema = createSelectSchema(dailyReportLogsTable);

export const googleDriveSettingsTable = pgTable("google_drive_settings", {
  id: text("id").primaryKey().default("drive_config"),
  googleAccountEmail: text("google_account_email"),
  googleClientId: text("google_client_id"),
  googleClientSecretEncrypted: text("google_client_secret_encrypted"),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  encryptedAccessToken: text("encrypted_access_token"),
  tokenExpiry: timestamp("token_expiry"),
  rootFolderId: text("root_folder_id"),
  customerDocumentsFolderId: text("customer_documents_folder_id"),
  connectionStatus: text("connection_status").default("Disconnected").notNull(),
  lastError: text("last_error"),
  connectedAt: timestamp("connected_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customerDocumentsTable = pgTable("customer_documents", {
  id: serial("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  customerName: text("customer_name"),
  serviceName: text("service_name"),
  acknowledgementNumber: text("acknowledgement_number"),
  driveFileId: text("drive_file_id").notNull(),
  driveFolderId: text("drive_folder_id").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileExtension: text("file_extension"),
  fileSize: integer("file_size").notNull(),
  category: text("category").default("General"),
  notes: text("notes"),
  uploadedBy: text("uploaded_by").default("Admin").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  uploadStatus: text("upload_status").default("completed").notNull(),
  deletionStatus: text("deletion_status").default("active").notNull(),
}, (table) => [
  index("idx_cust_docs_customer_id").on(table.customerId),
  index("idx_cust_docs_drive_file_id").on(table.driveFileId),
  index("idx_cust_docs_uploaded_at").on(table.uploadedAt),
  index("idx_cust_docs_deletion_status").on(table.deletionStatus),
]);

export const documentActivityLogsTable = pgTable("document_activity_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").default("Admin"),
  customerId: text("customer_id"),
  driveFileId: text("drive_file_id"),
  fileName: text("file_name"),
  actionType: text("action_type").notNull(),
  actionStatus: text("action_status").notNull(),
  errorDetails: text("error_details"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_doc_logs_customer_id").on(table.customerId),
  index("idx_doc_logs_timestamp").on(table.timestamp),
  index("idx_doc_logs_action").on(table.actionType),
]);

export const insertGoogleDriveSettingsSchema = createInsertSchema(googleDriveSettingsTable);
export const selectGoogleDriveSettingsSchema = createSelectSchema(googleDriveSettingsTable);
export const insertCustomerDocumentSchema = createInsertSchema(customerDocumentsTable).omit({ id: true, uploadedAt: true, updatedAt: true });
export const selectCustomerDocumentSchema = createSelectSchema(customerDocumentsTable);
export const insertDocumentActivityLogSchema = createInsertSchema(documentActivityLogsTable).omit({ id: true, timestamp: true });
export const selectDocumentActivityLogSchema = createSelectSchema(documentActivityLogsTable);

export type GoogleDriveSettings = typeof googleDriveSettingsTable.$inferSelect;
export type CustomerDocument = typeof customerDocumentsTable.$inferSelect;
export type InsertCustomerDocument = typeof customerDocumentsTable.$inferInsert;
export type DocumentActivityLog = typeof documentActivityLogsTable.$inferSelect;

export const governmentServicesTable = pgTable("government_services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  iconKey: text("icon_key").default("Globe").notNull(),
  iconType: text("icon_type").default("builtin").notNull(), // 'builtin' | 'favicon'
  faviconUrl: text("favicon_url"),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gov_services_position").on(table.position),
]);

export const insertGovernmentServiceSchema = createInsertSchema(governmentServicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectGovernmentServiceSchema = createSelectSchema(governmentServicesTable);
export type GovernmentService = typeof governmentServicesTable.$inferSelect;
export type InsertGovernmentService = typeof governmentServicesTable.$inferInsert;


