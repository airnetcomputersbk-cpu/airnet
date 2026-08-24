import { useMemo, useState, type ReactNode } from "react";
import logoImage from "@assets/LOGO_1787581255968.png";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Camera, Check, ChevronDown,
  CircleHelp, ClipboardList, Clock3, FileCheck2, FileText, IdCard,
  Landmark, Mail, MapPin, Menu, MessageCircle, Navigation, Phone, Plus,
  Printer, Receipt, ScanLine, Search, Send, ShieldCheck, Sparkles, Trash2,
  UsersRound, WalletCards, X, type LucideIcon,
} from "lucide-react";

type Service = {
  id: string;
  category: string;
  title: string;
  copy: string;
  timing: string;
  price: string;
  documents: string;
  icon: LucideIcon;
  accent: string;
};

const services: Service[] = [
  { id: "pan", category: "Identity", title: "PAN card services", copy: "New PAN applications, corrections, reprints and status checks — completed carefully, in plain language.", timing: "Usually 7–15 working days", price: "From ₹120", documents: "Aadhaar + mobile number", icon: IdCard, accent: "bg-[#f5e1ba]" },
  { id: "voter", category: "Identity", title: "Voter ID assistance", copy: "New voter registration, address changes, corrections and digital voter card support.", timing: "Application support in one visit", price: "From ₹80", documents: "Proof of age + address proof", icon: UsersRound, accent: "bg-[#d4e8e3]" },
  { id: "income", category: "Certificates", title: "Income certificate", copy: "We help you fill the right form, upload the documents and keep track until your certificate is ready.", timing: "Trackable online application", price: "From ₹150", documents: "Aadhaar + income proof", icon: FileCheck2, accent: "bg-[#e2d9ee]" },
  { id: "caste", category: "Certificates", title: "Caste certificate", copy: "Application and correction assistance for caste certificates, with a clear checklist before submission.", timing: "Application support in one visit", price: "From ₹150", documents: "Aadhaar + supporting proof", icon: FileText, accent: "bg-[#f3d3c9]" },
  { id: "residence", category: "Certificates", title: "Domicile / residence", copy: "Residence and domicile certificate form filling, document scanning and submission support.", timing: "Trackable online application", price: "From ₹150", documents: "Address proof + photo ID", icon: Landmark, accent: "bg-[#d8e5ef]" },
  { id: "birth-death", category: "Certificates", title: "Birth & death support", copy: "Get help with online requests, corrections and downloading official birth or death certificates.", timing: "Depends on record availability", price: "From ₹150", documents: "Existing record details", icon: ClipboardList, accent: "bg-[#e6e0c3]" },
  { id: "ration", category: "Forms & payments", title: "Ration card help", copy: "New applications, member additions, corrections and document uploads for ration card services.", timing: "Application support in one visit", price: "From ₹120", documents: "Family Aadhaar cards", icon: WalletCards, accent: "bg-[#d5e7de]" },
  { id: "payments", category: "Forms & payments", title: "Online payments", copy: "Electricity, water, mobile, insurance and other everyday payments — with a printed receipt.", timing: "Completed while you wait", price: "Clear service fee", documents: "Consumer or account number", icon: Receipt, accent: "bg-[#f2ddc5]" },
  { id: "print", category: "Forms & payments", title: "Print, scan & photo", copy: "Prints, scans, photocopies and passport-size photos for forms, exams and official applications.", timing: "Ready in minutes", price: "From ₹2", documents: "Bring files on phone or USB", icon: Printer, accent: "bg-[#d8def0]" },
];

const categories = ["All", "Identity", "Certificates", "Forms & payments"];

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [shortlist, setShortlist] = useState<Service[]>([]);
  const [shortlistOpen, setShortlistOpen] = useState(false);
  const [modal, setModal] = useState<"application" | "contact" | null>(null);
  const [selectedService, setSelectedService] = useState("");
  const [notice, setNotice] = useState("");

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return services.filter((service) => {
      const matchesCategory = activeCategory === "All" || service.category === activeCategory;
      const searchable = `${service.title} ${service.copy} ${service.category} ${service.documents}`.toLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
  }, [activeCategory, search]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function scrollTo(id: string) {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  function openApplication(service: string) {
    setSelectedService(service);
    setModal("application");
  }

  function addToShortlist(service: Service) {
    setShortlist((current) => current.some((item) => item.id === service.id) ? current : [...current, service]);
    flash(`${service.title} added to your enquiry list`);
  }

  function removeFromShortlist(id: string) {
    setShortlist((current) => current.filter((service) => service.id !== id));
  }

  function completeApplication() {
    setModal(null);
    flash("Request received. Airnet will call you to confirm the next step.");
  }

  return (
    <div className="noise min-h-[100dvh] overflow-x-hidden bg-[#f4efe4] text-[#15263b]">
      <header className="relative z-40 border-b border-[#1e4b75] bg-[#061f3d] text-[#f8f4eb]">
        <div className="container-airnet flex h-[78px] items-center justify-between gap-5">
          <button data-testid="button-logo" onClick={() => scrollTo("top")} className="group flex items-center gap-3 text-left">
            <img src={logoImage} alt="Airnet Computer logo" className="h-12 w-12 rounded-[12px] bg-white object-contain shadow-[4px_4px_0_#06101e] transition-transform group-hover:-translate-y-0.5" />
            <span>
              <span className="font-display block text-[17px] font-bold leading-none tracking-[-.04em]">Airnet Computer</span>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[.16em] text-[#afd0d4]">Online Service Center</span>
            </span>
          </button>
          <nav className="desktop-only flex items-center gap-7 text-[13px] font-semibold text-[#cfdae3]">
            <button data-testid="link-services" onClick={() => scrollTo("services")} className="transition-colors hover:text-[#f2b544]">Services</button>
            <button data-testid="link-how-it-works" onClick={() => scrollTo("how-it-works")} className="transition-colors hover:text-[#f2b544]">How it works</button>
            <button data-testid="link-documents" onClick={() => scrollTo("documents")} className="transition-colors hover:text-[#f2b544]">Documents</button>
            <button data-testid="link-visit" onClick={() => scrollTo("visit")} className="transition-colors hover:text-[#f2b544]">Visit us</button>
          </nav>
          <div className="flex items-center gap-2">
            <button data-testid="button-header-contact" onClick={() => setModal("contact")} className="desktop-only rounded-full border border-[#6686a2] px-4 py-2 text-[12px] font-bold transition-colors hover:border-[#f2b544] hover:text-[#f2b544]">Talk to a human</button>
            <button data-testid="button-shortlist" onClick={() => setShortlistOpen(true)} className="relative flex h-10 items-center gap-2 rounded-full bg-[#f2b544] px-3.5 text-[#032e60] transition-transform hover:scale-[1.03]">
              <ClipboardList size={17} strokeWidth={2.4} />
              <span className="hidden text-[12px] font-bold sm:inline">My enquiry list</span>
              {shortlist.length > 0 && <span data-testid="text-shortlist-count" className="grid h-5 min-w-5 place-items-center rounded-full bg-[#d96f4a] px-1 text-[10px] font-bold text-white">{shortlist.length}</span>}
            </button>
            <button data-testid="button-mobile-menu" onClick={() => setMobileOpen((value) => !value)} className="mobile-only grid h-10 w-10 place-items-center rounded-full border border-[#6686a2]">
              {mobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        {mobileOpen && <nav className="mobile-only border-t border-[#1e4b75] bg-[#0a294c] px-5 py-5">
          <div className="container-airnet flex flex-col gap-4 text-sm font-semibold">
            {[["Services", "services"], ["How it works", "how-it-works"], ["Documents", "documents"], ["Visit us", "visit"]].map(([label, id]) => (
              <button data-testid={`mobile-link-${id}`} key={id} onClick={() => scrollTo(id)} className="border-b border-[#355779] py-2 text-left text-[#e1e9ef]">{label}</button>
            ))}
            <button data-testid="mobile-button-contact" onClick={() => { setMobileOpen(false); setModal("contact"); }} className="mt-1 flex items-center gap-2 text-left text-[#f2b544]">Talk to a human <ArrowRight size={15} /></button>
          </div>
        </nav>}
      </header>

      <main id="top">
        <section className="hero-grid relative overflow-hidden bg-[#032e60] text-[#f8f4eb]">
          <div className="container-airnet relative grid min-h-[590px] items-center gap-12 py-14 lg:grid-cols-[1.04fr_.96fr] lg:py-16">
            <div className="relative z-10 max-w-[615px]">
              <div className="fade-up mb-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#a5d8c9]">
                <span className="h-px w-8 bg-[#f2b544]" /> Your local online service center
              </div>
              <h1 data-testid="text-hero-heading" className="fade-up font-display text-[clamp(3rem,7vw,5.7rem)] font-bold leading-[.92] tracking-[-.075em]">
                Online services,<br /><span className="text-[#f2b544]">locally explained.</span>
              </h1>
              <p data-testid="text-hero-copy" className="fade-up fade-up-delay mt-7 max-w-[510px] text-[17px] leading-7 text-[#c6d5df]">
                Apply for PAN, voter ID, certificates and everyday government forms with a little help from people nearby. Bring your documents. We’ll help with the rest.
              </p>
              <div className="fade-up fade-up-delay-2 mt-9 flex flex-wrap gap-3">
                <button data-testid="button-hero-start" onClick={() => scrollTo("services")} className="group flex items-center gap-3 rounded-full bg-[#f2b544] px-5 py-3.5 text-sm font-bold text-[#032e60] transition-all hover:bg-[#ffc968]">
                  Start an application <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button data-testid="button-hero-visit" onClick={() => scrollTo("visit")} className="flex items-center gap-2 rounded-full border border-[#6e8ca5] px-5 py-3.5 text-sm font-bold text-[#f8f4eb] transition-all hover:border-[#f2b544] hover:text-[#f2b544]">
                  Book a visit
                </button>
              </div>
              <div className="fade-up fade-up-delay-3 mt-11 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#244a70] pt-5 text-[11px] text-[#a7bdc9]">
                <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#a5d8c9]" /> Clear pricing before we begin</span>
                <span className="flex items-center gap-2"><Clock3 size={15} className="text-[#f2b544]" /> Track your application</span>
              </div>
            </div>
            <div className="relative min-h-[390px] lg:min-h-[440px]">
              <div className="absolute right-[4%] top-[6%] w-[min(390px,88%)] rotate-[-4deg] rounded-[24px] border border-[#7796aa] bg-[#174675] p-3 shadow-[20px_24px_0_rgba(2,19,41,.4)]">
                <div className="relative min-h-[300px] rounded-[15px] bg-[#f6f0e4] p-5 text-[#032e60]">
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[.14em] text-[#177d70]"><span>Airnet Computers Online Service center</span><span>open today</span></div>
                  <div className="mt-8 grid grid-cols-[1fr_auto] gap-4">
                    <div>
                      <p className="font-display text-[35px] font-bold leading-[.93] tracking-[-.07em]">Bring the<br /><span className="text-[#d96f4a]">paperwork.</span></p>
                      <p className="mt-5 max-w-[210px] text-[11px] leading-5 text-[#62727b]">We make the online part feel a lot less online.</p>
                    </div>
                    <div className="service-pattern grid h-24 w-24 place-items-center rounded-full border-2 border-[#d96f4a] text-center text-[9px] font-bold uppercase leading-3 tracking-[.1em] text-[#d96f4a]">apply<br />track<br />done</div>
                  </div>
                  <div className="absolute bottom-5 left-5 right-5 border-t border-[#d9cfbe] pt-3 text-[9px] font-bold uppercase tracking-[.13em] text-[#809092]">PAN · Voter ID · Certificates · Forms</div>
                </div>
              </div>
              <div className="absolute bottom-[3%] left-[1%] w-[195px] rotate-[5deg] rounded-[16px] border border-[#e6d2a7] bg-[#f7e7bd] p-4 text-[#153451] shadow-[10px_12px_0_rgba(2,19,41,.22)]">
                <Sparkles size={19} className="mb-4 text-[#d96f4a]" />
                <p className="font-display text-[20px] font-bold leading-tight tracking-[-.04em]">No jargon.<br />No guessing.</p>
                <p className="mt-3 text-[10px] leading-4 text-[#52616b]">Just a clear checklist and a next step.</p>
              </div>
              <div className="absolute right-[-2%] top-[1%] h-14 w-14 rounded-full border border-[#f2b544] opacity-60" />
              <div className="absolute right-[2%] top-[8%] h-2 w-2 rounded-full bg-[#f2b544]" />
            </div>
          </div>
          <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full border border-[#527493] opacity-30" />
        </section>

        <section className="border-b border-[#ded4c3] bg-[#ece5d8]">
          <div className="container-airnet grid grid-cols-2 gap-x-7 gap-y-6 py-7 md:grid-cols-4">
            {[
              ["12+", "years serving the neighbourhood"], ["9", "everyday services under one roof"], ["1 visit", "to get your application started"], ["100%", "clear before we charge"],
            ].map(([value, label], index) => <div data-testid={`stat-item-${index}`} key={label} className="flex flex-col gap-1 border-l-2 border-[#d96f4a] pl-3">
              <strong className="font-display text-xl font-bold tracking-[-.04em] text-[#032e60]">{value}</strong><span className="text-[11px] text-[#5f6e74]">{label}</span>
            </div>)}
          </div>
        </section>

        <section id="services" className="section-pad bg-[#f4efe4]">
          <div className="container-airnet">
            <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="eyebrow">Online services</p>
                <h2 className="font-display mt-3 text-4xl font-bold tracking-[-.06em] text-[#032e60] md:text-5xl">The important stuff,<br /><span className="serif-italic text-[#d96f4a]">made manageable.</span></h2>
                <p className="mt-4 max-w-[500px] text-sm leading-6 text-[#5f6e74]">Choose a service to see what to bring. Add it to your enquiry list or start a request now — there’s no account to create.</p>
              </div>
              <div className="relative w-full md:w-[300px]">
                <Search size={17} className="absolute left-3 top-3.5 text-[#66808e]" />
                <input data-testid="input-service-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PAN, voter ID, certificate..." className="h-11 w-full rounded-xl border border-[#d4c9b8] bg-[#fcfaf5] pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-[#839096] focus:border-[#177d70] focus:ring-2 focus:ring-[#bdddd3]" />
              </div>
            </div>
            <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => <button data-testid={`button-category-${category.toLowerCase().replaceAll(" ", "-")}`} key={category} onClick={() => setActiveCategory(category)} className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${activeCategory === category ? "bg-[#032e60] text-[#f8f4eb] shadow-[3px_3px_0_#f2b544]" : "border border-[#d4c9b8] bg-[#fcfaf5] text-[#52616b] hover:border-[#177d70] hover:text-[#177d70]"}`}>{category}</button>)}
              </div>
              <p data-testid="text-service-count" className="text-xs text-[#77858a]">{filteredServices.length} services available</p>
            </div>
            {filteredServices.length > 0 ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredServices.map((service) => <ServiceCard key={service.id} service={service} onStart={() => openApplication(service.title)} onAdd={() => addToShortlist(service)} isAdded={shortlist.some((item) => item.id === service.id)} />)}
            </div> : <div data-testid="empty-service-search" className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#c9bfaf] bg-[#fcfaf5] px-5 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#e2eee8] text-[#177d70]"><Search size={20} /></div>
              <h3 className="font-display text-xl font-bold text-[#032e60]">No service found</h3>
              <p className="mt-2 text-sm text-[#6b797b]">Try “PAN”, “certificate” or “print”, or ask us directly.</p>
              <button data-testid="button-clear-service-search" onClick={() => { setSearch(""); setActiveCategory("All"); }} className="mt-4 text-xs font-bold text-[#177d70] underline underline-offset-4">Clear filters</button>
            </div>}
            <div className="mt-7 flex flex-col items-start justify-between gap-4 border-t border-[#ddd4c5] pt-5 sm:flex-row sm:items-center">
              <span className="flex items-center gap-2 text-xs text-[#6b797b]"><MapPin size={14} className="text-[#d96f4a]" /> Visit Airnet Computers for help in person</span>
              <button data-testid="button-service-help" onClick={() => setModal("contact")} className="flex items-center gap-2 text-xs font-bold text-[#032e60]">Not sure which service? Talk to us <ArrowUpRight size={14} /></button>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="section-pad bg-[#e4f0eb]">
          <div className="container-airnet">
            <div className="grid gap-12 lg:grid-cols-[.73fr_1.27fr]">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 className="font-display mt-3 text-4xl font-bold leading-[.98] tracking-[-.065em] text-[#032e60] md:text-5xl">A little help<br /><span className="serif-italic text-[#177d70]">goes a long way.</span></h2>
                <p className="mt-5 max-w-[370px] text-sm leading-6 text-[#526d70]">Government websites can be confusing. We slow the process down, check the details and tell you what happens next.</p>
                <button data-testid="button-how-start" onClick={() => openApplication("General online service enquiry")} className="mt-7 flex items-center gap-2 text-sm font-bold text-[#032e60] underline decoration-[#f2b544] decoration-2 underline-offset-8">Start with a conversation <ArrowRight size={16} /></button>
              </div>
              <div className="divide-y divide-[#c7ddd4] border-y border-[#c7ddd4]">
                {[
                  { number: "01", title: "Tell us what you need", copy: "Choose a service online or walk in and explain it in your own words. We’ll make sure you’re in the right place.", icon: MessageCircle },
                  { number: "02", title: "Bring your documents", copy: "We check your originals, take the scans or copies needed and show you the service fee before submitting anything.", icon: FileCheck2 },
                  { number: "03", title: "Track the next step", copy: "Keep your acknowledgement or reference number. Come back for help checking the status or downloading the result.", icon: CircleHelp },
                ].map(({ number, title, copy, icon: Icon }) => <div key={number} className="group flex gap-5 py-6 first:pt-0 last:pb-0">
                  <span className="font-mono text-[11px] font-bold text-[#d96f4a]">{number}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3"><h3 className="font-display text-xl font-bold tracking-[-.04em] text-[#032e60]">{title}</h3><Icon size={21} className="shrink-0 text-[#177d70] transition-transform group-hover:rotate-[-8deg]" /></div>
                    <p className="mt-2 max-w-[540px] text-sm leading-6 text-[#5b7374]">{copy}</p>
                  </div>
                </div>)}
              </div>
            </div>
          </div>
        </section>

        <section id="documents" className="section-pad bg-[#f4efe4]">
          <div className="container-airnet">
            <div className="mb-11 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div><p className="eyebrow">Before you visit</p><h2 className="font-display mt-3 max-w-[600px] text-4xl font-bold leading-[.98] tracking-[-.065em] text-[#032e60] md:text-5xl">Bring what you have.<br /><span className="text-[#d96f4a]">We’ll check the rest.</span></h2></div>
              <p className="max-w-[330px] text-sm leading-6 text-[#6b797b]">Originals are helpful for checking. Bring a phone number that can receive OTPs and a few photocopies if you have them.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: IdCard, title: "Photo ID", copy: "Aadhaar, driving licence, voter ID or another accepted identity document." },
                { icon: FileText, title: "Address proof", copy: "Aadhaar, electricity bill, ration card or another current proof of address." },
                { icon: Camera, title: "Recent photo", copy: "Bring a passport-size photo, or use our quick photo service at the desk." },
              ].map(({ icon: Icon, title, copy }, index) => <div data-testid={`card-document-${index}`} key={title} className={`lift rounded-2xl p-7 ${index === 1 ? "bg-[#032e60] text-[#f8f4eb]" : "border border-[#ded5c6] bg-[#fcfaf5]"}`}>
                <Icon size={23} className={index === 1 ? "text-[#f2b544]" : "text-[#177d70]"} />
                <h3 className={`font-display mt-12 text-xl font-bold leading-tight tracking-[-.04em] ${index === 1 ? "text-[#f8f4eb]" : "text-[#032e60]"}`}>{title}</h3>
                <p className={`mt-3 text-sm leading-6 ${index === 1 ? "text-[#bfcfda]" : "text-[#667276]"}`}>{copy}</p>
              </div>)}
            </div>
            <div className="mt-10 grid gap-8 rounded-2xl bg-[#f0dfc6] p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10">
              <div><p className="eyebrow text-[#ad5a41]">A useful promise</p><blockquote className="mt-4 max-w-[730px] font-display text-2xl font-bold leading-tight tracking-[-.05em] text-[#032e60] md:text-3xl">“You never have to pretend you understood the form. Ask us, and we’ll go through it with you.”</blockquote><p className="mt-5 text-xs font-bold text-[#6e6e62]">— Md Amjad Ali, Airnet Computers</p></div>
              <div className="relative h-24 w-24 rotate-3 rounded-full border-2 border-[#d96f4a] p-2"><div className="grid h-full w-full place-items-center rounded-full border border-[#d96f4a] text-center text-[9px] font-bold uppercase leading-3 tracking-[.1em] text-[#ad5a41]">local<br />help<br />first</div></div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#d9e9ee] py-16">
          <div className="container-airnet relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div><p className="eyebrow text-[#17687d]">Need to check an application?</p><h2 className="font-display mt-3 max-w-[650px] text-3xl font-bold leading-tight tracking-[-.06em] text-[#032e60] md:text-4xl">Keep your reference number.<br /><span className="serif-italic text-[#17687d]">We’ll help track the rest.</span></h2></div>
            <button data-testid="button-cta-contact" onClick={() => setModal("contact")} className="group flex w-fit items-center gap-3 rounded-full bg-[#032e60] px-5 py-3.5 text-sm font-bold text-[#f8f4eb] transition-all hover:bg-[#0b477e]">Ask about tracking <MessageCircle size={17} className="text-[#f2b544] transition-transform group-hover:rotate-12" /></button>
          </div>
          <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full border border-[#8cb4c0]" />
        </section>

        <section id="visit" className="section-pad bg-[#032e60] text-[#f8f4eb]">
          <div className="container-airnet grid gap-12 lg:grid-cols-[1fr_.82fr]">
            <div>
              <p className="eyebrow text-[#a5d8c9]">Find Airnet Computers Online Service center</p>
              <h2 className="font-display mt-3 max-w-[560px] text-5xl font-bold leading-[.95] tracking-[-.07em] md:text-6xl">Bring the form.<br /><span className="text-[#f2b544]">Leave with a plan.</span></h2>
              <div className="mt-9 grid gap-5 text-sm text-[#c5d5df] sm:grid-cols-2">
                 <div className="flex gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-[#f2b544]" /><span>Opp. Congress Office, Near Omer Masjid<br />Haralayya Chowk, Basavakalyan – 585327</span></div>
                 <div className="flex gap-3"><Clock3 size={18} className="mt-0.5 shrink-0 text-[#a5d8c9]" /><span>Mon–Sat 10 AM to 10 PM<br />Sun 1 PM to 9 PM</span></div>
                 <div className="flex gap-3"><Phone size={18} className="mt-0.5 shrink-0 text-[#f2b544]" /><span>Md Amjad Ali<br />+91 7892881086</span></div>
                 <div className="flex gap-3"><Mail size={18} className="mt-0.5 shrink-0 text-[#a5d8c9]" /><span>Call Md Amjad Ali<br />for help with your application</span></div>
              </div>
               <div className="mt-9 flex flex-wrap gap-3"><a data-testid="button-get-directions" href="https://www.google.com/maps/place/Airnet+Computers.+Amjad+Ali,+Haralayya+Chowk+oppsite+Kaish+Motor+Hero+Showroom,+near+omer+masjid,+Basavakalyan,+Karnataka+585327/data=!4m2!3m1!1s0x3bcf3be23e8892a9:0x84ce7fa678a0994d!18m1!1e1?utm_source=mstt_1&entry=gps&coh=192189&g_ep=CAESBzI2LjE3LjUYACCenQoqngEsOTQyNjc3MjcsOTQyOTIxOTUsOTQyOTk1MzIsMTAwNzk2NDk4LDEwMDc5Nzc2MSwxMDA3OTY1MzUsOTQyODQ0NTQsOTQyODA1NzYsOTQyMDczOTQsOTQyMDc1MDYsOTQyMDg1MDYsOTQyMTg2NTMsOTQyMjk4MzksOTQyNzUxNjgsOTQyNzk2MTksMTAwNzk5MjQ2LDEwMDc5MjU2OE" target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full bg-[#f2b544] px-5 py-3 text-sm font-bold text-[#032e60] hover:bg-[#ffc968]"><Navigation size={15} /> Get directions</a><a data-testid="button-call-desk" href="tel:+917892881086" className="flex items-center gap-2 rounded-full border border-[#63829d] px-5 py-3 text-sm font-bold hover:border-[#f2b544] hover:text-[#f2b544]"><Phone size={15} /> Call Md Amjad Ali</a></div>
            </div>
            <div className="relative min-h-[290px] overflow-hidden rounded-2xl border border-[#355779] bg-[#0d3a69] p-6">
              <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(#6c8ba2 1px, transparent 1px), linear-gradient(90deg, #6c8ba2 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
              <div className="relative flex h-full flex-col justify-between">
                 <div className="flex items-start justify-between"><div className="rounded-lg bg-[#f2b544] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#032e60]">Airnet Computers Online Service center</div><div className="grid h-10 w-10 place-items-center rounded-full border border-[#f2b544] text-[#f2b544]"><MapPin size={18} /></div></div>
                <div className="self-center text-center"><div className="mx-auto mb-3 h-3 w-3 rounded-full bg-[#f2b544] shadow-[0_0_0_8px_rgba(242,181,68,.18)]" /><p className="font-display text-2xl font-bold tracking-[-.05em]">Friendly help<br />for online forms</p></div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-[.16em] text-[#9bb2c3]"><span>walk in welcome</span><span>clear next step</span></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#02234a] py-8 text-[#95aec0]">
        <div className="container-airnet flex flex-col justify-between gap-5 text-xs md:flex-row md:items-center">
          <span className="font-display font-bold text-[#f8f4eb]">Airnet Computers Online Service center</span>
          <span>Practical online help, close to home.</span>
          <div className="flex gap-5"><button data-testid="footer-link-privacy" onClick={() => flash("We handle your documents carefully and only for the service you request.")} className="hover:text-[#f2b544]">Privacy</button><button data-testid="footer-link-contact" onClick={() => setModal("contact")} className="hover:text-[#f2b544]">Contact</button></div>
        </div>
      </footer>

      {notice && <div data-testid="status-notice" className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#032e60] px-4 py-3 text-xs font-bold text-[#f8f4eb] shadow-[0_12px_32px_rgba(3,46,96,.25)]"><Check size={15} className="text-[#a5d8c9]" /> {notice}</div>}
      {shortlistOpen && <ShortlistDrawer shortlist={shortlist} onClose={() => setShortlistOpen(false)} onRemove={removeFromShortlist} onStart={() => { setShortlistOpen(false); openApplication(shortlist.map((item) => item.title).join(", ")); }} />}
      {modal === "application" && <ApplicationModal service={selectedService} onClose={() => setModal(null)} onComplete={completeApplication} />}
      {modal === "contact" && <ContactModal onClose={() => setModal(null)} onComplete={() => { setModal(null); flash("Message sent — thanks for reaching out."); }} />}
    </div>
  );
}

function ServiceCard({ service, onStart, onAdd, isAdded }: { service: Service; onStart: () => void; onAdd: () => void; isAdded: boolean }) {
  const Icon = service.icon;
  return <article data-testid={`card-service-${service.id}`} className="lift group relative flex min-h-[365px] flex-col overflow-hidden rounded-2xl border border-[#ded5c6] bg-[#fcfaf5] p-4">
    <div className={`relative flex h-[132px] items-center justify-center overflow-hidden rounded-xl ${service.accent}`}>
      <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full border border-[#ffffff90]" /><div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full border border-[#ffffff90]" />
      <div className="relative grid h-20 w-24 place-items-center rounded-[18px] border-2 border-[#23405a] bg-[#f7f4eb] shadow-[6px_7px_0_#23405a]"><Icon size={38} strokeWidth={1.5} className="text-[#177d70]" /></div>
      <span className="absolute left-3 top-3 rounded-full bg-[#032e60] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-[#f8f4eb]">{service.category}</span>
    </div>
    <div className="flex flex-1 flex-col pt-4">
      <h3 className="font-display text-xl font-bold tracking-[-.045em] text-[#032e60]">{service.title}</h3>
      <p className="mt-2 text-xs leading-5 text-[#687579]">{service.copy}</p>
      <div className="mt-4 grid gap-2 text-[11px] text-[#667276]"><span className="flex items-center gap-2"><Clock3 size={13} className="text-[#d96f4a]" /> {service.timing}</span><span className="flex items-center gap-2"><FileText size={13} className="text-[#177d70]" /> Bring: {service.documents}</span></div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#e5dccd] pt-4"><span className="font-display text-base font-bold text-[#032e60]">{service.price}</span><div className="flex items-center gap-2"><button data-testid={`button-add-service-${service.id}`} onClick={onAdd} aria-label={`Add ${service.title} to enquiry list`} className={`grid h-9 w-9 place-items-center rounded-full transition-all ${isAdded ? "bg-[#d8e9df] text-[#177d70]" : "bg-[#e8eee9] text-[#032e60] hover:rotate-90 hover:bg-[#f2b544]"}`}>{isAdded ? <Check size={17} /> : <Plus size={17} />}</button><button data-testid={`button-start-service-${service.id}`} onClick={onStart} className="rounded-full bg-[#032e60] px-3.5 py-2 text-[11px] font-bold text-[#f8f4eb] transition-colors hover:bg-[#0b477e]">Start</button></div></div>
    </div>
  </article>;
}

function ModalFrame({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop fixed inset-0 z-[60] grid place-items-center bg-[#032e60]/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-panel relative max-h-[90dvh] w-full max-w-[500px] overflow-y-auto rounded-2xl border border-[#e1d7c6] bg-[#fcfaf5] p-6 shadow-[0_24px_80px_rgba(3,46,96,.3)] md:p-8">
      <button data-testid="button-close-modal" onClick={onClose} aria-label="Close dialog" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#ede8dc] text-[#52616b] hover:bg-[#f2b544] hover:text-[#032e60]"><X size={17} /></button>
      <p className="eyebrow">{eyebrow}</p><h2 className="font-display mt-3 pr-8 text-3xl font-bold leading-none tracking-[-.06em] text-[#032e60]">{title}</h2>
      {children}
    </div>
  </div>;
}

function ApplicationModal({ service, onClose, onComplete }: { service: string; onClose: () => void; onComplete: () => void }) {
  return <ModalFrame title="Start an application" eyebrow="A clear first step" onClose={onClose}>
    <p className="mt-4 text-sm leading-6 text-[#657276]">Tell us a little about what you need. We’ll call to confirm documents, pricing and the best time to visit.</p>
    <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); onComplete(); }}>
      <label className="block text-xs font-bold text-[#31495b]">Service needed<select data-testid="select-application-service" defaultValue={service} className="mt-1.5 h-11 w-full rounded-xl border border-[#d6cbb9] bg-[#fffdf8] px-3 text-sm outline-none focus:border-[#177d70]"><option>{service}</option>{services.filter((item) => item.title !== service).map((item) => <option key={item.id}>{item.title}</option>)}</select></label>
      <label className="block text-xs font-bold text-[#31495b]">Your name<input data-testid="input-application-name" required placeholder="Full name" className="mt-1.5 h-11 w-full rounded-xl border border-[#d6cbb9] bg-[#fffdf8] px-3 text-sm font-normal outline-none placeholder:text-[#929b99] focus:border-[#177d70]" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-bold text-[#31495b]">Mobile number<input data-testid="input-application-phone" required type="tel" placeholder="10 digit mobile" className="mt-1.5 h-11 w-full rounded-xl border border-[#d6cbb9] bg-[#fffdf8] px-3 text-sm font-normal outline-none placeholder:text-[#929b99] focus:border-[#177d70]" /></label><label className="block text-xs font-bold text-[#31495b]">Preferred visit<select data-testid="select-application-visit" defaultValue="Any weekday" className="mt-1.5 h-11 w-full rounded-xl border border-[#d6cbb9] bg-[#fffdf8] px-3 text-sm font-normal outline-none focus:border-[#177d70]"><option>Any weekday</option><option>Saturday morning</option><option>I’ll call first</option></select></label></div>
      <label className="block text-xs font-bold text-[#31495b]">Anything we should know? <span className="font-normal text-[#8b9491]">(optional)</span><textarea data-testid="input-application-note" rows={3} placeholder="For example: I already have a reference number..." className="mt-1.5 w-full resize-none rounded-xl border border-[#d6cbb9] bg-[#fffdf8] p-3 text-sm font-normal outline-none placeholder:text-[#929b99] focus:border-[#177d70]" /></label>
      <button data-testid="button-submit-application" type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#032e60] px-5 py-3.5 text-sm font-bold text-[#f8f4eb] transition-colors hover:bg-[#0b477e]">Send application request <Send size={16} className="text-[#f2b544]" /></button>
      <p className="flex items-center justify-center gap-1.5 text-[10px] text-[#7b8582]"><ShieldCheck size={12} className="text-[#177d70]" /> No account needed. We only use this to call you back.</p>
    </form>
  </ModalFrame>;
}

function ContactModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  return <ModalFrame title="Talk to a human" eyebrow="Airnet help desk" onClose={onClose}>
    <p className="mt-4 text-sm leading-6 text-[#657276]">Tell us what’s confusing and we’ll point you in the right direction. You can also call <strong className="text-[#032e60]">Md Amjad Ali at +91 7892881086</strong>.</p>
    <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); onComplete(); }}>
      <label className="block text-xs font-bold text-[#31495b]">Your name<input data-testid="input-contact-name" required placeholder="Full name" className="mt-1.5 h-11 w-full rounded-xl border border-[#d6cbb9] bg-[#fffdf8] px-3 text-sm font-normal outline-none placeholder:text-[#929b99] focus:border-[#177d70]" /></label>
      <label className="block text-xs font-bold text-[#31495b]">Mobile or email<input data-testid="input-contact-details" required placeholder="How should we reach you?" className="mt-1.5 h-11 w-full rounded-xl border border-[#d6cbb9] bg-[#fffdf8] px-3 text-sm font-normal outline-none placeholder:text-[#929b99] focus:border-[#177d70]" /></label>
      <label className="block text-xs font-bold text-[#31495b]">Your question<textarea data-testid="input-contact-message" required rows={4} placeholder="I need help with..." className="mt-1.5 w-full resize-none rounded-xl border border-[#d6cbb9] bg-[#fffdf8] p-3 text-sm font-normal outline-none placeholder:text-[#929b99] focus:border-[#177d70]" /></label>
      <button data-testid="button-submit-contact" type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#032e60] px-5 py-3.5 text-sm font-bold text-[#f8f4eb] transition-colors hover:bg-[#0b477e]">Send message <Send size={16} className="text-[#f2b544]" /></button>
    </form>
  </ModalFrame>;
}

function ShortlistDrawer({ shortlist, onClose, onRemove, onStart }: { shortlist: Service[]; onClose: () => void; onRemove: (id: string) => void; onStart: () => void }) {
  return <div className="fixed inset-0 z-[60] bg-[#032e60]/55" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="drawer absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col bg-[#fcfaf5] shadow-[-18px_0_60px_rgba(3,46,96,.2)]">
      <div className="flex items-start justify-between border-b border-[#e0d6c7] p-6"><div><p className="eyebrow">Your shortlist</p><h2 className="font-display mt-2 text-3xl font-bold tracking-[-.06em] text-[#032e60]">What you need help with</h2></div><button data-testid="button-close-shortlist" onClick={onClose} aria-label="Close enquiry list" className="grid h-9 w-9 place-items-center rounded-full bg-[#ede8dc] text-[#52616b] hover:bg-[#f2b544]"><X size={17} /></button></div>
      <div className="flex-1 overflow-y-auto p-6">
        {shortlist.length > 0 ? <div className="space-y-3">{shortlist.map((service) => <div data-testid={`shortlist-item-${service.id}`} key={service.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e0d6c7] bg-[#f6f0e4] p-4"><div><p className="font-display text-base font-bold text-[#032e60]">{service.title}</p><p className="mt-1 text-xs text-[#748083]">{service.price} · {service.timing}</p></div><button data-testid={`button-remove-shortlist-${service.id}`} onClick={() => onRemove(service.id)} aria-label={`Remove ${service.title}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#87918f] hover:bg-[#f3d5cb] hover:text-[#b6533d]"><Trash2 size={15} /></button></div>)}</div> : <div data-testid="empty-shortlist" className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfc3b1] bg-[#f6f0e4] px-6 text-center"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#dcebe5] text-[#177d70]"><ClipboardList size={21} /></div><h3 className="font-display mt-4 text-xl font-bold text-[#032e60]">Your list is empty</h3><p className="mt-2 text-sm leading-6 text-[#71807f]">Add services you want to ask about, then send one enquiry.</p><button data-testid="button-close-empty-shortlist" onClick={onClose} className="mt-5 text-xs font-bold text-[#177d70] underline underline-offset-4">Browse services</button></div>}
      </div>
      <div className="border-t border-[#e0d6c7] bg-[#f6f0e4] p-6"><button data-testid="button-start-shortlist" disabled={shortlist.length === 0} onClick={onStart} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#032e60] px-5 py-3.5 text-sm font-bold text-[#f8f4eb] transition-colors hover:bg-[#0b477e] disabled:cursor-not-allowed disabled:bg-[#b7bfbb]">Send one enquiry <ArrowRight size={16} className="text-[#f2b544]" /></button><p className="mt-3 text-center text-[10px] text-[#7b8582]">We’ll confirm the documents and clear pricing by phone.</p></div>
    </aside>
  </div>;
}

export default App;