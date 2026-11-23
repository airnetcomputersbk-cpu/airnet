export interface NotificationApplication {
  customerId: string;
  customerName: string;
  mobileNumber: string;
  serviceName: string;
}

export const AIRNET_MAPS_URL = "https://maps.app.goo.gl/boUHFrmjBcsLkwms9";
export const AIRNET_WHATSAPP_BUSINESS_NUMBER = "+91 7892881086";
export const AIRNET_HELPLINE_DISPLAY = "+91 7892881086";

/**
 * Template A: When Admin Accepts an Application
 */
export function getAcceptedWhatsAppMessage(app: NotificationApplication): string {
  const customerId = app.customerId || "AN-Pending";
  const customerName = app.customerName || "Customer";
  const mobileNumber = app.mobileNumber || "";
  const serviceName = app.serviceName || "Online Service";

  return `Your Customer Reference

${customerId}

Applicant: ${customerName}

Mobile Number: ${mobileNumber}

Service: ${serviceName}

Status: ● Application Accepted

Your application enquiry has been reviewed and accepted by Airnet Computers (Md Amjad Ali). Our team will contact you on ${mobileNumber} to confirm the required documents and proceed with your application.

Thank you for choosing Airnet Computers!
${AIRNET_MAPS_URL}`;
}

/**
 * Template B: When Admin Rejects an Application
 */
export function getRejectedWhatsAppMessage(app: NotificationApplication): string {
  const customerId = app.customerId || "AN-Pending";
  const customerName = app.customerName || "Customer";
  const mobileNumber = app.mobileNumber || "";
  const serviceName = app.serviceName || "Online Service";

  return `Your Customer Reference

${customerId}

Applicant: ${customerName}

Mobile Number: ${mobileNumber}

Service: ${serviceName}

Status: ● Application Rejected

We regret to inform you that your application enquiry has been rejected by Airnet Computers (Md Amjad Ali).

For further clarification, please contact our office at ${AIRNET_HELPLINE_DISPLAY}.

Thank you for your understanding.
${AIRNET_MAPS_URL}`;
}

/**
 * Template C: When Admin Places an Application on Hold
 */
export function getOnHoldWhatsAppMessage(app: NotificationApplication): string {
  const customerId = app.customerId || "AN-Pending";
  const customerName = app.customerName || "Customer";
  const mobileNumber = app.mobileNumber || "";
  const serviceName = app.serviceName || "Online Service";

  return `Your Customer Reference

${customerId}

Applicant: ${customerName}

Mobile Number: ${mobileNumber}

Service: ${serviceName}

Status: ● Application On Hold

Your application enquiry is currently on hold. Airnet Computers (Md Amjad Ali) will contact you on ${mobileNumber} if additional information or documents are required.

For assistance, contact ${AIRNET_HELPLINE_DISPLAY}.

Thank you for choosing Airnet Computers!
${AIRNET_MAPS_URL}`;
}

/**
 * Helper to open WhatsApp Web/App addressed to the customer
 */
export function openWhatsAppChat(customerMobile: string, messageText: string): void {
  const cleanPhone = customerMobile.replace(/\D/g, "").slice(-10);
  if (!cleanPhone) {
    alert("Customer mobile number is missing or invalid.");
    return;
  }
  const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(messageText)}`;
  window.open(url, "_blank");
}
