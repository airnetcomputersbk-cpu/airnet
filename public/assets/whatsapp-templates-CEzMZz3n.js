const c="https://maps.app.goo.gl/boUHFrmjBcsLkwms9",s="+91 7892881086",i="+91 7892881086";function u(e){const r=e.customerId||"AN-Pending",t=e.customerName||"Customer",o=e.mobileNumber||"",n=e.serviceName||"Online Service";return`Your Customer Reference

${r}

Applicant: ${t}

Mobile Number: ${o}

Service: ${n}

Status: ● Application Accepted

Your application enquiry has been reviewed and accepted by Airnet Computers (Md Amjad Ali). Our team will contact you on ${o} to confirm the required documents and proceed with your application.

Thank you for choosing Airnet Computers!
${c}`}function a(e){const r=e.customerId||"AN-Pending",t=e.customerName||"Customer",o=e.mobileNumber||"",n=e.serviceName||"Online Service";return`Your Customer Reference

${r}

Applicant: ${t}

Mobile Number: ${o}

Service: ${n}

Status: ● Application Rejected

We regret to inform you that your application enquiry has been rejected by Airnet Computers (Md Amjad Ali).

For further clarification, please contact our office at ${i}.

Thank you for your understanding.
${c}`}function m(e){const r=e.customerId||"AN-Pending",t=e.customerName||"Customer",o=e.mobileNumber||"",n=e.serviceName||"Online Service";return`Your Customer Reference

${r}

Applicant: ${t}

Mobile Number: ${o}

Service: ${n}

Status: ● Application On Hold

Your application enquiry is currently on hold. Airnet Computers (Md Amjad Ali) will contact you on ${o} if additional information or documents are required.

For assistance, contact ${i}.

Thank you for choosing Airnet Computers!
${c}`}function l(e,r){const t=e.replace(/\D/g,"").slice(-10);if(!t){alert("Customer mobile number is missing or invalid.");return}const o=`https://wa.me/91${t}?text=${encodeURIComponent(r)}`;window.open(o,"_blank")}export{s as A,a,u as b,m as g,l as o};
