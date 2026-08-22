import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Check, CircleHelp,
  Clock3, FileText, HardDrive, Keyboard, Laptop, Mail, MapPin, Menu, MessageCircle,
  Minus, Monitor, Navigation, Phone, Plus, Router, Search, Send, ShieldCheck,
  ShoppingBag, Sparkles, Trash2, Wrench, X, Zap, type LucideIcon,
} from "lucide-react";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  detail: string;
  badge?: string;
  color: string;
  icon: LucideIcon;
};
type CartLine = { product: Product; quantity: number };

const products: Product[] = [
  { id: 1, name: "Airnet Workmate 14", category: "Laptops", price: 549, detail: "14″ / Ryzen 5 / 8GB / 256GB SSD", badge: "Best seller", color: "bg-[#d8eee7]", icon: Laptop },
  { id: 2, name: "Lenovo ThinkPad E14", category: "Laptops", price: 729, detail: "14″ / Core i5 / 16GB / 512GB SSD", badge: "Staff pick", color: "bg-[#e8e0f2]", icon: Laptop },
  { id: 3, name: "Dell OptiPlex Mini", category: "Desktops", price: 389, detail: "Core i5 / 16GB / 256GB SSD", color: "bg-[#dae6f1]", icon: Monitor },
  { id: 4, name: "Airnet Home Tower", category: "Desktops", price: 649, detail: "Ryzen 5 / 16GB / 512GB SSD", color: "bg-[#f7dfc9]", icon: Monitor },
  { id: 5, name: "Logitech MK295 Combo", category: "Accessories", price: 34.5, detail: "Silent wireless keyboard + mouse", color: "bg-[#f3e6b7]", icon: Keyboard },
  { id: 6, name: "TP-Link Archer C6", category: "Accessories", price: 42, detail: "AC1200 dual-band Wi-Fi router", badge: "In stock", color: "bg-[#d7e6dc]", icon: Router },
  { id: 7, name: "Crucial 500GB SSD", category: "Accessories", price: 48, detail: "SATA 2.5″ / upgrade kit included", color: "bg-[#e8dfd8]", icon: HardDrive },
];

const services = [
  { icon: Wrench, number: "01", title: "Laptop & desktop repair", copy: "From cracked screens to a machine that simply refuses to start. We diagnose first, explain clearly, and fix what makes sense.", link: "See repair services" },
  { icon: FileText, number: "02", title: "Online form assistance", copy: "Government forms, school applications, registrations and printing. Bring the paperwork; we’ll help you get it right.", link: "Ask about forms" },
  { icon: Zap, number: "03", title: "Setup & tune-up", copy: "A new computer should feel ready, not overwhelming. We move your files, set up your essentials and leave you confident.", link: "Book a setup" },
];

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [modal, setModal] = useState<"booking" | "contact" | "checkout" | null>(null);
  const [selectedService, setSelectedService] = useState("");
  const [notice, setNotice] = useState("");

  const categories = ["All", "Laptops", "Desktops", "Accessories"];
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = activeCategory === "All" || product.category === activeCategory;
      return matchesCategory && (!query || `${product.name} ${product.detail} ${product.category}`.toLowerCase().includes(query));
    });
  }, [activeCategory, search]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }
  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) return current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { product, quantity: 1 }];
    });
    setCartOpen(true);
    flash(`${product.name} added to your bag`);
  }
  function changeQuantity(id: number, delta: number) {
    setCart((current) => current.map((line) => line.product.id === id ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0));
  }
  function openBooking(service: string) {
    setSelectedService(service);
    setModal("booking");
  }
  function scrollTo(id: string) {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="noise min-h-[100dvh] overflow-x-hidden bg-[#f6f2e9] text-[#15263b]">
      <header className="relative z-40 border-b border-[#254669] bg-[#032e60] text-[#f8f4eb]">
        <div className="container-airnet flex h-[78px] items-center justify-between gap-6">
          <button data-testid="button-logo" onClick={() => scrollTo("top")} className="group flex items-center gap-3 text-left">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#f3ae35] text-[#032e60] shadow-[4px_4px_0_#0b2340] transition-transform group-hover:-translate-y-0.5">
              <span className="font-display text-xl font-bold">A</span>
            </span>
            <span>
              <span className="font-display block text-[18px] font-bold leading-none tracking-[-.04em]">airnet</span>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[.2em] text-[#a9c7d8]">computers</span>
            </span>
          </button>
          <nav className="desktop-only flex items-center gap-8 text-[13px] font-semibold text-[#c9d7e2]">
            <button data-testid="link-shop" onClick={() => scrollTo("shop")} className="transition-colors hover:text-[#f3ae35]">Shop</button>
            <button data-testid="link-services" onClick={() => scrollTo("services")} className="transition-colors hover:text-[#f3ae35]">Services</button>
            <button data-testid="link-why-airnet" onClick={() => scrollTo("why-airnet")} className="transition-colors hover:text-[#f3ae35]">Why Airnet</button>
            <button data-testid="link-visit" onClick={() => scrollTo("visit")} className="transition-colors hover:text-[#f3ae35]">Visit us</button>
          </nav>
          <div className="flex items-center gap-2">
            <button data-testid="button-header-contact" onClick={() => setModal("contact")} className="desktop-only rounded-full border border-[#5c7995] px-4 py-2 text-[12px] font-bold transition-colors hover:border-[#f3ae35] hover:text-[#f3ae35]">Talk to a human</button>
            <button data-testid="button-cart" onClick={() => setCartOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-full bg-[#f3ae35] text-[#032e60] transition-transform hover:scale-105">
              <ShoppingBag size={17} strokeWidth={2.5} />
              {cartCount > 0 && <span data-testid="text-cart-count" className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#e56d4f] px-1 text-[10px] font-bold text-white">{cartCount}</span>}
            </button>
            <button data-testid="button-mobile-menu" onClick={() => setMobileOpen((v) => !v)} className="mobile-only grid h-10 w-10 place-items-center rounded-full border border-[#5c7995]">
              {mobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        {mobileOpen && <nav className="mobile-only border-t border-[#254669] bg-[#062754] px-5 py-5">
          <div className="container-airnet flex flex-col gap-4 text-sm font-semibold">
            {[
              ["Shop", "shop"], ["Services", "services"], ["Why Airnet", "why-airnet"], ["Visit us", "visit"],
            ].map(([label, id]) => <button data-testid={`mobile-link-${id}`} key={id} onClick={() => scrollTo(id)} className="border-b border-[#355779] py-2 text-left text-[#e1e9ef]">{label}</button>)}
            <button data-testid="mobile-button-contact" onClick={() => { setMobileOpen(false); setModal("contact"); }} className="mt-1 flex items-center gap-2 text-left text-[#f3ae35]">Talk to a human <ArrowRight size={15} /></button>
          </div>
        </nav>}
      </header>

      <main id="top">
        <section className="hero-grid relative overflow-hidden bg-[#032e60] text-[#f8f4eb]">
          <div className="container-airnet relative grid min-h-[570px] items-center gap-10 py-16 lg:grid-cols-[1.03fr_.97fr] lg:py-20">
            <div className="relative z-10 max-w-[600px]">
              <div className="fade-up mb-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#9bd3c4]">
                <span className="h-px w-8 bg-[#f3ae35]" /> Your neighbourhood tech desk
              </div>
              <h1 data-testid="text-hero-heading" className="fade-up fade-up-delay font-display text-[clamp(3.1rem,7vw,5.7rem)] font-bold leading-[.94] tracking-[-.075em]">
                Tech that<br /><span className="text-[#f3ae35]">makes sense.</span>
              </h1>
              <p data-testid="text-hero-copy" className="fade-up fade-up-delay-2 mt-7 max-w-[470px] text-[17px] leading-7 text-[#c3d3df]">
                Computers, repairs and practical digital help from people who speak human. Find the right setup — and know where to go when it needs a little care.
              </p>
              <div className="fade-up fade-up-delay-2 mt-9 flex flex-wrap gap-3">
                <button data-testid="button-hero-shop" onClick={() => scrollTo("shop")} className="group flex items-center gap-3 rounded-full bg-[#f3ae35] px-5 py-3.5 text-sm font-bold text-[#032e60] transition-all hover:bg-[#ffc45b]">
                  Browse the shop <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button data-testid="button-hero-repair" onClick={() => openBooking("Laptop & desktop repair")} className="flex items-center gap-2 rounded-full border border-[#6e8ca5] px-5 py-3.5 text-sm font-bold text-[#f8f4eb] transition-all hover:border-[#f3ae35] hover:text-[#f3ae35]">
                  Book a repair
                </button>
              </div>
              <div className="mt-12 flex items-center gap-5 border-t border-[#244a70] pt-5 text-[11px] text-[#9fb5c6]">
                <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#9bd3c4]" /> Local & independent</span>
                <span className="flex items-center gap-2"><Clock3 size={15} className="text-[#f3ae35]" /> Same-week repairs</span>
              </div>
            </div>
            <div className="relative hidden min-h-[400px] lg:block">
              <div className="absolute right-[6%] top-[12%] h-[330px] w-[400px] rotate-[-7deg] rounded-[28px] border-2 border-[#7b9ab3] bg-[#173f6a] shadow-[22px_26px_0_rgba(2,19,41,.4)]">
                <div className="absolute inset-[15px] rounded-[16px] bg-[#e8f0ed] p-5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-[.12em] text-[#177f72]"><span>airnet / ready</span><span>14:28</span></div>
                  <div className="mt-9 font-display text-[31px] font-bold leading-[.95] tracking-[-.07em] text-[#032e60]">Work<br />without<br /><span className="text-[#e56d4f]">worry.</span></div>
                  <div className="absolute bottom-6 left-5 right-5 flex items-end justify-between"><span className="h-1.5 w-16 rounded-full bg-[#f3ae35]" /><span className="text-[9px] text-[#657a88]">built for the everyday</span></div>
                </div>
                <div className="absolute -bottom-8 left-1/2 h-8 w-24 -translate-x-1/2 rounded-b-lg bg-[#7890a4]" />
                <div className="absolute -bottom-10 left-[19%] h-2 w-[62%] rounded-full bg-[#9ab0bd]" />
              </div>
              <div className="absolute bottom-[9%] left-[3%] w-[180px] rotate-[5deg] rounded-[18px] border border-[#e3d3ab] bg-[#f7ebca] p-4 text-[#153451] shadow-[10px_12px_0_rgba(2,19,41,.22)]">
                <Sparkles size={19} className="mb-4 text-[#e56d4f]" />
                <p className="font-display text-[19px] font-bold leading-tight tracking-[-.04em]">No jargon.<br />No pressure.</p>
                <p className="mt-3 text-[10px] leading-4 text-[#52616b]">Just a good answer and a clear next step.</p>
              </div>
              <div className="absolute right-[-4%] top-[5%] h-14 w-14 rounded-full border border-[#f3ae35] opacity-60" />
              <div className="absolute right-[1%] top-[11%] h-2 w-2 rounded-full bg-[#f3ae35]" />
            </div>
          </div>
          <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full border border-[#527493] opacity-30" />
        </section>

        <section className="border-b border-[#dfd7c8] bg-[#ede8dc]">
          <div className="container-airnet grid grid-cols-2 gap-x-8 gap-y-6 py-7 md:grid-cols-4">
            {[
              ["4.9 / 5", "average local rating"], ["12+", "years keeping tech useful"], ["1,240", "devices fixed & counting"], ["100%", "clear before we charge"],
            ].map(([value, label], index) => <div data-testid={`stat-item-${index}`} key={label} className="flex flex-col gap-1 border-l-2 border-[#f3ae35] pl-3">
              <strong className="font-display text-xl font-bold tracking-[-.04em] text-[#032e60]">{value}</strong><span className="text-[11px] text-[#5f6e74]">{label}</span>
            </div>)}
          </div>
        </section>

        <section id="shop" className="section-pad bg-[#f6f2e9]">
          <div className="container-airnet">
            <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="eyebrow">The useful stuff</p>
                <h2 className="font-display mt-3 text-4xl font-bold tracking-[-.06em] text-[#032e60] md:text-5xl">Good tech, <span className="serif-italic text-[#e56d4f]">properly chosen.</span></h2>
                <p className="mt-3 max-w-[480px] text-sm leading-6 text-[#5f6e74]">Reliable daily drivers and the accessories that make them feel like yours. Come in, try things, ask us anything.</p>
              </div>
              <div className="relative w-full md:w-[260px]">
                <Search size={17} className="absolute left-3 top-3.5 text-[#66808e]" />
                <input data-testid="input-product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the shop" className="h-11 w-full rounded-xl border border-[#d7cdbd] bg-[#fbf8f1] pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-[#839096] focus:border-[#177f72] focus:ring-2 focus:ring-[#b7ddd2]" />
              </div>
            </div>
            <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => <button data-testid={`button-category-${category.toLowerCase()}`} key={category} onClick={() => setActiveCategory(category)} className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${activeCategory === category ? "bg-[#032e60] text-[#f8f4eb] shadow-[3px_3px_0_#f3ae35]" : "border border-[#d7cdbd] bg-[#fbf8f1] text-[#52616b] hover:border-[#177f72] hover:text-[#177f72]"}`}>{category}</button>)}
              </div>
              <p data-testid="text-product-count" className="text-xs text-[#77858a]">{filteredProducts.length} items to explore</p>
            </div>
            {filteredProducts.length > 0 ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {filteredProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} />)}
            </div> : <div data-testid="empty-product-search" className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#c9bfaf] bg-[#fbf8f1] px-5 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#e5eee9] text-[#177f72]"><Search size={20} /></div>
              <h3 className="font-display text-xl font-bold text-[#032e60]">Nothing matching that search</h3>
              <p className="mt-2 text-sm text-[#6b797b]">Try a different word, or call us — we may have it on the shelf.</p>
              <button data-testid="button-clear-search" onClick={() => { setSearch(""); setActiveCategory("All"); }} className="mt-4 text-xs font-bold text-[#177f72] underline underline-offset-4">Clear filters</button>
            </div>}
            <div className="mt-7 flex items-center justify-between border-t border-[#ddd4c5] pt-5">
              <span className="flex items-center gap-2 text-xs text-[#6b797b]"><MapPin size={14} className="text-[#e56d4f]" /> Free local pickup at 18 Market Street</span>
              <button data-testid="button-shop-help" onClick={() => setModal("contact")} className="hidden items-center gap-2 text-xs font-bold text-[#032e60] sm:flex">Need help choosing? <ArrowUpRight size={14} /></button>
            </div>
          </div>
        </section>

        <section id="services" className="section-pad bg-[#e6f0eb]">
          <div className="container-airnet">
            <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
              <div>
                <p className="eyebrow">More than a shop</p>
                <h2 className="font-display mt-3 text-4xl font-bold leading-[.98] tracking-[-.065em] text-[#032e60] md:text-5xl">When tech gets <span className="serif-italic text-[#177f72]">stubborn.</span></h2>
                <p className="mt-5 max-w-[370px] text-sm leading-6 text-[#526d70]">You don’t need to know the answer before you walk in. Tell us what’s happening in plain English and we’ll take it from there.</p>
                <button data-testid="button-all-services" onClick={() => openBooking("General enquiry")} className="mt-7 flex items-center gap-2 text-sm font-bold text-[#032e60] underline decoration-[#f3ae35] decoration-2 underline-offset-8">Start with a conversation <ArrowRight size={16} /></button>
              </div>
              <div className="divide-y divide-[#c8ddd5] border-y border-[#c8ddd5]">
                {services.map((service) => <div key={service.number} className="group flex gap-5 py-6 first:pt-0 last:pb-0">
                  <span className="font-mono text-[11px] font-bold text-[#e56d4f]">{service.number}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display text-xl font-bold tracking-[-.04em] text-[#032e60]">{service.title}</h3>
                      <service.icon size={21} className="shrink-0 text-[#177f72] transition-transform group-hover:rotate-[-8deg]" />
                    </div>
                    <p className="mt-2 max-w-[540px] text-sm leading-6 text-[#5b7374]">{service.copy}</p>
                    <button data-testid={`button-service-${service.number}`} onClick={() => openBooking(service.title)} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#177f72]">{service.link} <ArrowRight size={13} /></button>
                  </div>
                </div>)}
              </div>
            </div>
          </div>
        </section>

        <section id="why-airnet" className="section-pad bg-[#f6f2e9]">
          <div className="container-airnet">
            <div className="mb-11 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div><p className="eyebrow">The Airnet difference</p><h2 className="font-display mt-3 max-w-[560px] text-4xl font-bold leading-[.98] tracking-[-.065em] text-[#032e60] md:text-5xl">Straight answers.<br /><span className="text-[#e56d4f]">Solid work.</span></h2></div>
              <p className="max-w-[310px] text-sm leading-6 text-[#6b797b]">The best technology help is the kind that leaves you feeling more capable than when you arrived.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: BadgeCheck, title: "We tell you what we’d tell a friend", copy: "No upselling, no mysterious line items. If a repair isn’t worth the money, we’ll say so." },
                { icon: CircleHelp, title: "Questions are always welcome", copy: "There’s no such thing as a silly tech question here. We’ll slow down and show you, too." },
                { icon: ShieldCheck, title: "Your data stays yours", copy: "We treat every device and document with care. Privacy is part of the job, not an add-on." },
              ].map(({ icon: Icon, title, copy }, index) => <div data-testid={`card-trust-${index}`} key={title} className={`lift rounded-2xl p-7 ${index === 1 ? "bg-[#032e60] text-[#f8f4eb]" : "border border-[#ded5c6] bg-[#fbf8f1]"}`}>
                <Icon size={23} className={index === 1 ? "text-[#f3ae35]" : "text-[#177f72]"} />
                <h3 className={`font-display mt-12 text-xl font-bold leading-tight tracking-[-.04em] ${index === 1 ? "text-[#f8f4eb]" : "text-[#032e60]"}`}>{title}</h3>
                <p className={`mt-3 text-sm leading-6 ${index === 1 ? "text-[#bfcfda]" : "text-[#667276]"}`}>{copy}</p>
              </div>)}
            </div>
            <div className="mt-10 grid gap-8 rounded-2xl bg-[#f0dfc6] p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10">
              <div><p className="eyebrow text-[#ad5a41]">A note from the desk</p><blockquote className="mt-4 max-w-[700px] font-display text-2xl font-bold leading-tight tracking-[-.05em] text-[#032e60] md:text-3xl">“We opened Airnet because good help shouldn’t require a password, a ticket number, or pretending you understand the jargon.”</blockquote><p className="mt-5 text-xs font-bold text-[#6e6e62]">— Maya & Dev, the people behind Airnet</p></div>
              <div className="relative h-24 w-24 rotate-3 rounded-full border-2 border-[#e56d4f] p-2"><div className="grid h-full w-full place-items-center rounded-full border border-[#e56d4f] text-center text-[9px] font-bold uppercase leading-3 tracking-[.1em] text-[#ad5a41]">Local<br />people<br />power</div></div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#d9e9ee] py-16">
          <div className="container-airnet relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div><p className="eyebrow text-[#17687d]">Not sure what you need?</p><h2 className="font-display mt-3 max-w-[620px] text-3xl font-bold leading-tight tracking-[-.06em] text-[#032e60] md:text-4xl">Describe the problem.<br /><span className="serif-italic text-[#17687d]">We’ll find the next step.</span></h2></div>
            <button data-testid="button-cta-contact" onClick={() => setModal("contact")} className="group flex w-fit items-center gap-3 rounded-full bg-[#032e60] px-5 py-3.5 text-sm font-bold text-[#f8f4eb] transition-all hover:bg-[#0b477e]">Talk it through <MessageCircle size={17} className="text-[#f3ae35] transition-transform group-hover:rotate-12" /></button>
          </div>
          <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full border border-[#8cb4c0]" />
        </section>

        <section id="visit" className="section-pad bg-[#032e60] text-[#f8f4eb]">
          <div className="container-airnet grid gap-12 lg:grid-cols-[1fr_.82fr]">
            <div>
              <p className="eyebrow text-[#9bd3c4]">Find us on Market Street</p>
              <h2 className="font-display mt-3 max-w-[550px] text-5xl font-bold leading-[.95] tracking-[-.07em] md:text-6xl">Come by.<br /><span className="text-[#f3ae35]">We’re here.</span></h2>
              <div className="mt-9 grid gap-5 text-sm text-[#c5d5df] sm:grid-cols-2">
                <div className="flex gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-[#f3ae35]" /><span>18 Market Street<br />Geelong VIC 3220</span></div>
                <div className="flex gap-3"><Clock3 size={18} className="mt-0.5 shrink-0 text-[#9bd3c4]" /><span>Mon–Fri 9am–5:30pm<br />Sat 9am–1pm</span></div>
                <div className="flex gap-3"><Phone size={18} className="mt-0.5 shrink-0 text-[#f3ae35]" /><span>(03) 5221 4088<br />Call before you come in</span></div>
                <div className="flex gap-3"><Mail size={18} className="mt-0.5 shrink-0 text-[#9bd3c4]" /><span>hello@airnet.com.au<br />We reply within a day</span></div>
              </div>
              <div className="mt-9 flex flex-wrap gap-3"><button data-testid="button-get-directions" onClick={() => flash("Directions are ready — we’ll see you soon.")} className="flex items-center gap-2 rounded-full bg-[#f3ae35] px-5 py-3 text-sm font-bold text-[#032e60] hover:bg-[#ffc45b]"><Navigation size={15} /> Get directions</button><button data-testid="button-call-shop" onClick={() => flash("Calling (03) 5221 4088…")} className="flex items-center gap-2 rounded-full border border-[#63829d] px-5 py-3 text-sm font-bold hover:border-[#f3ae35] hover:text-[#f3ae35]"><Phone size={15} /> Call the shop</button></div>
            </div>
            <div className="relative min-h-[290px] overflow-hidden rounded-2xl border border-[#355779] bg-[#0d3a69] p-6">
              <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(#6c8ba2 1px, transparent 1px), linear-gradient(90deg, #6c8ba2 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between"><div className="rounded-lg bg-[#f3ae35] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#032e60]">Airnet Computers</div><div className="grid h-10 w-10 place-items-center rounded-full border border-[#f3ae35] text-[#f3ae35]"><MapPin size={18} /></div></div>
                <div className="self-center text-center"><div className="mx-auto mb-3 h-3 w-3 rounded-full bg-[#f3ae35] shadow-[0_0_0_8px_rgba(243,174,53,.18)]" /><p className="font-display text-2xl font-bold tracking-[-.05em]">Your local<br />tech desk</p></div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-[.16em] text-[#9bb2c3]"><span>easy to find</span><span>hard to forget</span></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#02234a] py-8 text-[#95aec0]">
        <div className="container-airnet flex flex-col justify-between gap-5 text-xs md:flex-row md:items-center">
          <span className="font-display font-bold text-[#f8f4eb]">airnet computers</span>
          <span>Useful technology, since 2012.</span>
          <div className="flex gap-5"><button data-testid="footer-link-privacy" onClick={() => flash("Privacy is important to us. Ask in store for our policy.")} className="hover:text-[#f3ae35]">Privacy</button><button data-testid="footer-link-contact" onClick={() => setModal("contact")} className="hover:text-[#f3ae35]">Contact</button></div>
        </div>
      </footer>

      {notice && <div data-testid="status-notice" className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#032e60] px-4 py-3 text-xs font-bold text-[#f8f4eb] shadow-[0_12px_32px_rgba(3,46,96,.25)]"><Check size={15} className="text-[#9bd3c4]" /> {notice}</div>}
      {cartOpen && <CartDrawer cart={cart} total={cartTotal} onClose={() => setCartOpen(false)} onChange={changeQuantity} onCheckout={() => { setCartOpen(false); setModal("checkout"); }} />}
      {modal === "booking" && <BookingModal service={selectedService} onClose={() => setModal(null)} onComplete={() => { setModal(null); flash("Request received — we’ll be in touch shortly."); }} />}
      {modal === "contact" && <ContactModal onClose={() => setModal(null)} onComplete={() => { setModal(null); flash("Message sent — thanks for reaching out."); }} />}
      {modal === "checkout" && <CheckoutModal total={cartTotal} onClose={() => setModal(null)} onComplete={() => { setModal(null); setCart([]); flash("Pickup request received. We’ll confirm your order by phone."); }} />}
    </div>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const Icon = product.icon;
  return <article data-testid={`card-product-${product.id}`} className="product-card lift group relative flex min-h-[328px] flex-col overflow-hidden rounded-2xl border border-[#ded5c6] bg-[#fbf8f1] p-4">
    <div className={`product-visual relative flex h-[155px] items-center justify-center overflow-hidden rounded-xl ${product.color}`}>
      <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full border border-[#ffffff80]" /><div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full border border-[#ffffff80]" />
      <div className="relative grid h-24 w-32 place-items-center rounded-lg border-2 border-[#23405a] bg-[#f0f3ed] shadow-[7px_8px_0_#23405a]"><Icon size={43} strokeWidth={1.35} className="text-[#177f72]" /><span className="absolute bottom-2 text-[6px] font-bold uppercase tracking-[.15em] text-[#647582]">airnet ready</span></div>
      {product.badge && <span className="absolute left-3 top-3 rounded-full bg-[#032e60] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-[#f8f4eb]">{product.badge}</span>}
    </div>
    <div className="flex flex-1 flex-col pt-4"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#177f72]">{product.category}</p><h3 className="font-display mt-1 text-lg font-bold tracking-[-.045em] text-[#032e60]">{product.name}</h3><p className="mt-1 text-xs leading-5 text-[#768084]">{product.detail}</p>
      <div className="mt-auto flex items-end justify-between pt-4"><span className="font-display text-xl font-bold text-[#032e60]">${product.price.toFixed(2)}</span><button data-testid={`button-add-product-${product.id}`} onClick={onAdd} className="grid h-9 w-9 place-items-center rounded-full bg-[#e9f0eb] text-[#032e60] transition-all hover:bg-[#f3ae35] hover:rotate-90"><Plus size={17} /></button></div>
    </div>
  </article>;
}

function ModalFrame({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop fixed inset-0 z-[60] grid place-items-center bg-[#032e60]/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-panel relative max-h-[90dvh] w-full max-w-[500px] overflow-y-auto rounded-2xl border border-[#e1d7c6] bg-[#fbf8f1] p-6 shadow-[0_24px_80px_rgba(3,46,96,.3)] md:p-8">
      <button data-testid="button-close-modal" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#ede8dc] text-[#52616b] hover:bg-[#f3ae35] hover:text-[#032e60]"><X size={17} /></button>
      <p className="eyebrow">{eyebrow}</p><h2 className="font-display mt-2 pr-8 text-3xl font-bold leading-none tracking-[-.06em] text-[#032e60]">{title}</h2>{children}
    </div>
  </div>;
}

function BookingModal({ service, onClose, onComplete }: { service: string; onClose: () => void; onComplete: () => void }) {
  const [sent, setSent] = useState(false);
  if (sent) return <ModalFrame eyebrow="You’re on the list" title="We’ll take it from here." onClose={onClose}><div className="mt-7 rounded-xl bg-[#e6f0eb] p-5 text-sm leading-6 text-[#526d70]"><Check className="mb-3 text-[#177f72]" />Thanks — your request is in. We’ll call during opening hours to find a time that works.</div><button data-testid="button-booking-done" onClick={onClose} className="mt-6 w-full rounded-full bg-[#032e60] py-3.5 text-sm font-bold text-[#f8f4eb]">Done</button></ModalFrame>;
  return <ModalFrame eyebrow="Book a service" title="Let’s get this sorted." onClose={onClose}><p className="mt-4 text-sm leading-6 text-[#667276]">Tell us a little about what you need. No account needed — a real person will get back to you.</p><form onSubmit={(event) => { event.preventDefault(); setSent(true); }} className="mt-6 space-y-4">
    <label className="block text-xs font-bold text-[#52616b]">I need help with<input data-testid="input-booking-service" required value={service} onChange={() => {}} className="mt-2 h-11 w-full rounded-xl border border-[#d7cdbd] bg-white/60 px-3 text-sm outline-none focus:border-[#177f72]" /></label>
    <label className="block text-xs font-bold text-[#52616b]">Your name<input data-testid="input-booking-name" required placeholder="How should we address you?" className="mt-2 h-11 w-full rounded-xl border border-[#d7cdbd] bg-white/60 px-3 text-sm outline-none focus:border-[#177f72]" /></label>
    <label className="block text-xs font-bold text-[#52616b]">Phone number<input data-testid="input-booking-phone" required type="tel" placeholder="Best number to reach you" className="mt-2 h-11 w-full rounded-xl border border-[#d7cdbd] bg-white/60 px-3 text-sm outline-none focus:border-[#177f72]" /></label>
    <label className="block text-xs font-bold text-[#52616b]">Anything we should know?<textarea data-testid="input-booking-notes" rows={3} placeholder="A quick description is perfect" className="mt-2 w-full resize-none rounded-xl border border-[#d7cdbd] bg-white/60 p-3 text-sm outline-none focus:border-[#177f72]" /></label>
    <button data-testid="button-submit-booking" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#f3ae35] py-3.5 text-sm font-bold text-[#032e60] hover:bg-[#ffc45b]">Request a callback <ArrowRight size={16} /></button>
  </form></ModalFrame>;
}

function ContactModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  return <ModalFrame eyebrow="Say hello" title="What can we help with?" onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onComplete(); }} className="mt-6 space-y-4">
    <input data-testid="input-contact-name" required placeholder="Your name" className="h-11 w-full rounded-xl border border-[#d7cdbd] bg-white/60 px-3 text-sm outline-none focus:border-[#177f72]" /><input data-testid="input-contact-email" required type="email" placeholder="Email address" className="h-11 w-full rounded-xl border border-[#d7cdbd] bg-white/60 px-3 text-sm outline-none focus:border-[#177f72]" /><textarea data-testid="input-contact-message" required rows={4} placeholder="Tell us what’s on your mind" className="w-full resize-none rounded-xl border border-[#d7cdbd] bg-white/60 p-3 text-sm outline-none focus:border-[#177f72]" /><button data-testid="button-submit-contact" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#032e60] py-3.5 text-sm font-bold text-[#f8f4eb] hover:bg-[#0b477e]">Send message <Send size={16} className="text-[#f3ae35]" /></button>
  </form></ModalFrame>;
}

function CheckoutModal({ total, onClose, onComplete }: { total: number; onClose: () => void; onComplete: () => void }) {
  return <ModalFrame eyebrow="Local pickup" title="Reserve your tech." onClose={onClose}><p className="mt-4 text-sm leading-6 text-[#667276]">We’ll hold your items at the desk and call to confirm. No online payment, no surprises.</p><div className="mt-5 flex items-center justify-between rounded-xl bg-[#e6f0eb] p-4 text-sm"><span>Estimated total</span><strong className="font-display text-xl text-[#032e60]">${total.toFixed(2)}</strong></div><form onSubmit={(event) => { event.preventDefault(); onComplete(); }} className="mt-5 space-y-4"><input data-testid="input-checkout-name" required placeholder="Your name" className="h-11 w-full rounded-xl border border-[#d7cdbd] bg-white/60 px-3 text-sm outline-none focus:border-[#177f72]" /><input data-testid="input-checkout-phone" required type="tel" placeholder="Phone number" className="h-11 w-full rounded-xl border border-[#d7cdbd] bg-white/60 px-3 text-sm outline-none focus:border-[#177f72]" /><button data-testid="button-submit-checkout" className="w-full rounded-full bg-[#f3ae35] py-3.5 text-sm font-bold text-[#032e60] hover:bg-[#ffc45b]">Request pickup call</button></form></ModalFrame>;
}

function CartDrawer({ cart, total, onClose, onChange, onCheckout }: { cart: CartLine[]; total: number; onClose: () => void; onChange: (id: number, delta: number) => void; onCheckout: () => void }) {
  return <div className="fixed inset-0 z-[55] bg-[#032e60]/45" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="cart-drawer absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col bg-[#fbf8f1] shadow-[-20px_0_60px_rgba(3,46,96,.2)]">
    <div className="flex items-center justify-between border-b border-[#ded5c6] p-5"><div><p className="eyebrow">Your bag</p><h2 className="font-display mt-1 text-2xl font-bold tracking-[-.06em] text-[#032e60]">Ready when you are.</h2></div><button data-testid="button-close-cart" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[#ede8dc] hover:bg-[#f3ae35]"><X size={17} /></button></div>
    <div className="flex-1 overflow-y-auto p-5">{cart.length === 0 ? <div data-testid="empty-cart" className="flex h-full flex-col items-center justify-center px-6 text-center"><div className="grid h-14 w-14 place-items-center rounded-full bg-[#e6f0eb] text-[#177f72]"><ShoppingBag size={23} /></div><h3 className="font-display mt-4 text-xl font-bold text-[#032e60]">Your bag is empty</h3><p className="mt-2 text-sm leading-6 text-[#68777b]">A good place to start is the shop. Add something useful and it’ll show up here.</p><button data-testid="button-empty-cart-shop" onClick={onClose} className="mt-5 rounded-full bg-[#032e60] px-5 py-3 text-xs font-bold text-[#f8f4eb]">Keep browsing</button></div> : <div className="space-y-4">{cart.map((line) => <div data-testid={`cart-line-${line.product.id}`} key={line.product.id} className="flex gap-3 border-b border-[#e3dbce] pb-4"><div className={`grid h-16 w-16 shrink-0 place-items-center rounded-xl ${line.product.color}`}><line.product.icon size={25} className="text-[#177f72]" /></div><div className="min-w-0 flex-1"><h3 className="truncate font-display text-sm font-bold text-[#032e60]">{line.product.name}</h3><p className="mt-1 text-xs text-[#6d7a7c]">${line.product.price.toFixed(2)} each</p><div className="mt-2 flex items-center gap-2"><button data-testid={`button-decrease-${line.product.id}`} onClick={() => onChange(line.product.id, -1)} className="grid h-6 w-6 place-items-center rounded-full border border-[#cfc5b5] text-[#52616b] hover:bg-[#f3ae35]"><Minus size={12} /></button><span data-testid={`text-quantity-${line.product.id}`} className="w-4 text-center text-xs font-bold">{line.quantity}</span><button data-testid={`button-increase-${line.product.id}`} onClick={() => onChange(line.product.id, 1)} className="grid h-6 w-6 place-items-center rounded-full border border-[#cfc5b5] text-[#52616b] hover:bg-[#f3ae35]"><Plus size={12} /></button></div></div><div className="flex flex-col items-end justify-between"><strong className="font-display text-sm text-[#032e60]">${(line.product.price * line.quantity).toFixed(2)}</strong><button data-testid={`button-remove-${line.product.id}`} onClick={() => onChange(line.product.id, -line.quantity)} className="text-[#9a6960] hover:text-[#e56d4f]"><Trash2 size={14} /></button></div></div>)}</div>}</div>
    {cart.length > 0 && <div className="border-t border-[#ded5c6] bg-[#f2ecdf] p-5"><div className="flex justify-between text-sm text-[#68777b]"><span>Subtotal</span><strong data-testid="text-cart-total" className="font-display text-xl text-[#032e60]">${total.toFixed(2)}</strong></div><p className="mt-2 text-[11px] text-[#7a8583]">Pickup is free at our Market Street desk.</p><button data-testid="button-checkout" onClick={onCheckout} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#f3ae35] py-3.5 text-sm font-bold text-[#032e60] hover:bg-[#ffc45b]">Reserve for pickup <ArrowRight size={16} /></button></div>}
  </aside></div>;
}

export default App;