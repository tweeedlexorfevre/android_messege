import { Search, Sparkles, MessageCircle } from "lucide-react";
import { Link } from "wouter";

type Thread = {
  id: string;
  title: string;
  preview: string;
  time: string;
  unread?: number;
  accent?: "alert" | "brand";
};

const threads: Thread[] = [
  {
    id: "rescue",
    title: "!Служба спасения",
    preview:
      "08.02.26 Almaty k. tuman kutlilude, koktaigak kateri. V g. Almaty ozhidaetsya tuman, ugroza gololeda.",
    time: "20:13",
    unread: 127,
    accent: "alert",
  },
  {
    id: "1414",
    title: "1414",
    preview: "Бул код тек аутентификация үшін арналған. КОДТЫ ЕШКІМГЕ АЙТПАҢЫЗ!",
    time: "пт",
  },
  {
    id: "9909",
    title: "9909",
    preview: "Кате. Каражат жетпеди. Тенгерiмдегi сома кем дегенде \"Жолакы + 1 тенге\" болуы керек.",
    time: "пт",
  },
  {
    id: "janymdа",
    title: "Janymda",
    preview: "Напоминание из Janymda: награда уже готова — осталось только забрать её 👉 https://beeline.news/get",
    time: "ср",
    unread: 1,
    accent: "brand",
  },
  {
    id: "beeline",
    title: "Beeline",
    preview: "Денсаулығыңызға 15% қайтарым. Дәрі-дәрмек, дәрумендер және дәріханалардан табуға болатын барлық заттарды сатып алудан Janymda қо...",
    time: "вт",
    unread: 87,
  },
  {
    id: "beehome",
    title: "BeeHome",
    preview: "Ертең “Үйдегі Интернеттің” абоненттік төлемі күні. Бірақ Сізде 17999 тг жетпейді. Осы соманы 0014598700 логинїңізге мына жерде салыңызшы ...",
    time: "31 янв.",
    unread: 2,
  },
  {
    id: "beelnfo",
    title: "Beelnfo",
    preview: "я. Если хотите, можно повысить скорость для 10 ГБ за 1990 тенге: просто наберите *916*10#",
    time: "28 янв.",
    unread: 4,
  },
  {
    id: "jetpay",
    title: "jetpay.kz",
    preview: "jetpay.kz 31317",
    time: "7 янв.",
  },
  {
    id: "yandexpro",
    title: "YandexPro",
    preview: "Яндекс Доставкаға қош келдіңіз! Яндекс.Pro қолданбасын орнатыңыз — ya.cc/2tKRo...",
    time: "29 дек.",
    unread: 1,
  },
  {
    id: "yandex",
    title: "Yandex",
    preview: "<#>Your confirmation code: 929944. bBOAWTuHSBe",
    time: "29 дек.",
    unread: 2,
  },
  {
    id: "forte",
    title: "ForteBank",
    preview: "Жаңа жылдық сыйқыр ForteMarket-те! “NEW26” промокод арқылы 15 000 ₸ жеңілдік + 20% Бонус. ...",
    time: "27 дек.",
    unread: 1,
  },
  {
    id: "halyk",
    title: "Halyk",
    preview: "Код Halyk: 6206. НЕ ГОВОРИТЕ КОД ОПАСАЙТЕСЬ МОШЕННИКОВ!",
    time: "18 дек.",
    unread: 1,
    accent: "alert",
  },
  {
    id: "wildberries",
    title: "Wildberries",
    preview: "Vash kod avtorizacii v LK: 951778. Nikomu ego ne govorite! Wildberries. fpN/ dzqm7X2",
    time: "11 дек.",
    unread: 2,
  },
  {
    id: "uch",
    title: "UCH",
    preview: "1779 - код подтверждения. НИКОМУ НЕ СООБЩАЙТЕ!",
    time: "30 нояб.",
  },
  {
    id: "qsms",
    title: "QSMS",
    preview: "Your Claude verification code is: 502172",
    time: "29 нояб.",
    unread: 2,
  },
  {
    id: "technodom",
    title: "TECHNODOM",
    preview: "Technodom-да — Kaspi Жұма! Барлығы 0-0-24 бөліп төлеу жүйесімен аласыз. Техникаға 60%-ға дейін жеңілдік! Өзіңізге жақын дүкенге келіңіз...",
    time: "8 нояб.",
    unread: 1,
  },
  {
    id: "kaspi",
    title: "kaspi.kz",
    preview: "Никому не говорите код! Вы входите на Kaspi.kz...",
    time: "8 нояб.",
    unread: 4,
  },
  {
    id: "bankffin",
    title: "BANKFFIN",
    preview: "Код верификации 3675",
    time: "нт",
    unread: 1,
  },
];

const baseThreadLink = "/chat?mode=api&platform=android";

export default function Messages() {
  return (
    <div className="min-h-screen text-white bg-[#121316] safe-area-top safe-area-bottom relative overflow-hidden">
      <div className="absolute -top-24 -right-12 w-64 h-64 rounded-full bg-[#16181C] blur-3xl opacity-25 pointer-events-none" />
      <div className="absolute top-40 -left-16 w-64 h-64 rounded-full bg-[#14161A] blur-3xl opacity-30 pointer-events-none" />

      <div className="relative z-10 w-full px-0 pb-24">
        <div className="pt-10 pb-12 relative">
          <div className="absolute right-2 flex items-center gap-2" style={{ top: "33vh" }}>
            <button className="w-10 h-10 rounded-full bg-[#2A2B30] border border-transparent flex items-center justify-center text-[#EDEDED] shadow-[0_6px_14px_rgba(0,0,0,0.25)]">
              <Search size={18} />
            </button>
            <button className="w-10 h-10 rounded-full bg-[#4A362D] border border-transparent flex items-center justify-center text-sm font-medium text-[#F0F0F0] shadow-[0_6px_14px_rgba(0,0,0,0.25)]">
              T
            </button>
          </div>
          <div className="mt-38 mb-10 text-center">
            <div className="text-[20px] font-medium tracking-[0.01em] text-[#F2F2F2]">
              Google <span className="text-[#D0D0D0]">Сообщения</span>
            </div>
          </div>
        </div>

        <div className="h-[12vh]" />
        <div className="bg-[#141518] rounded-[18px] overflow-hidden pt-2">
          {threads.map((thread) => {
            const isAlert = thread.accent === "alert";
            const isBrand = thread.accent === "brand";
            const avatarBg = isAlert
              ? "bg-[#F06B5E]"
              : isBrand
              ? "bg-[#68E2BD]"
              : "bg-[#2B2D32]";
            const unread = thread.unread && thread.unread > 0;
            const badgeText = thread.unread && thread.unread > 99 ? "99+" : `${thread.unread ?? ""}`;

            return (
              <Link key={thread.id} href={baseThreadLink} className="block">
                <div className="px-3 py-2 flex gap-2 items-start">
                  <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center text-white text-sm font-medium`}>
                    {isAlert ? "!" : "•"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-[13px] tracking-[0.01em] truncate text-[#F2F2F2]">{thread.title}</div>
                      <div className="text-[12px] text-[#9A9A9A] shrink-0">{thread.time}</div>
                    </div>
                    <div
                      className="text-[12px] text-[#9A9A9A] mt-0.5 overflow-hidden"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {thread.preview}
                    </div>
                  </div>
                  {unread ? (
                    <div className="w-3.5 h-3.5 rounded-full bg-[#7D93FF] shadow-[0_0_0_3px_rgba(125,147,255,0.18)] shrink-0 mt-1" />
                  ) : null}
                  {unread ? (
                    <div className="sr-only">
                      {badgeText}
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-6 right-5 flex flex-col gap-3 z-20">
        <Link href={baseThreadLink} className="block">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#5B78FF] to-[#3A57FF] border border-transparent flex items-center justify-center text-white shadow-[0_18px_30px_rgba(20,35,90,0.55)]">
            <MessageCircle size={20} />
          </div>
        </Link>
      </div>
    </div>
  );
}
