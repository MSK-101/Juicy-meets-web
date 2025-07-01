import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[url('/home/hero_bg.png')] bg-cover bg-center bg-no-repeat">
      <header className="flex justify-between items-center bg-black/10 backdrop-blur-xs shadow-2xl p-5 lg:px-14 lg:py-8">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="Juicy Meets"
            width={56}
            height={40}
            className="h-8 w-auto cursor-pointer hover:scale-105 duration-300"
          />
        </Link>
        <div className="flex items-center gap-4 md:gap-14">
          <div className="text-base md:text-lg hidden lg:block">
            <span className="font-semibold">3,435,789</span> Online Video
            Chatters
          </div>

          <button className="cursor-pointer hover:scale-105 duration-300">
            Language
          </button>
          <button className="bg-white text-black py-2 px-4 rounded-full cursor-pointer hover:scale-105 duration-300">
            Login/Sign Up
          </button>
        </div>
      </header>

      {/* Counter for mobile */}
      <div className="text-base font-medium text-center my-12 lg:hidden">
        3,435,789 Online Video Chatters
      </div>

      <div className="flex justify-center md:justify-around overflow-hidden gap-4 md:gap-5 px-5 my-5">
        <Image
          src="/home/hero_img_1.png"
          alt="Profile"
          width={1000}
          height={100}
          className="w-[150px] lg:w-[280px] xl:w[320px] shadow-lg"
        />
        <Image
          src="/home/hero_img_2.png"
          alt="Profile"
          width={1000}
          height={100}
          className="w-[150px] lg:w-[280px] xl:w[320px] shadow-lg"
        />
        <Image
          src="/home/hero_img_3.png"
          alt="Profile"
          width={1000}
          height={100}
          className="w-[150px] lg:w-[280px] xl:w[320px] shadow-lg"
        />
        <Image
          src="/home/hero_img_4.png"
          alt="Profile"
          width={1000}
          height={100}
          className="w-[150px] lg:w-[280px] xl:w[320px] shadow-lg"
        />
      </div>

      <div className="flex flex-col items-center text-center px-5 mt-4 lg:mt-6">
        <button
          className="py-4 px-8 rounded-full font-bold text-base md:text-xl my-6 cursor-pointer duration-300 shadow-[0_0_80px_#df42ff] hover:scale-105"
          style={{
            background: "linear-gradient(90deg, #cb00ff 0%, #df42ff 100%)",
          }}
        >
          START VIDEO CHAT
        </button>

        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[3rem] my-4">
          Welcome to Juicy Meets Chats.
        </h1>

        <p className="text-sm sm:text-base md:text-lg lg:text-xl max-w-[700px] leading-relaxed animate-in fade-in slide-in-from-bottom duration-500 delay-300">
          Connecting people worldwide to build meaningful relationships across
          cultures and borders.
        </p>
      </div>
    </div>
  );
}
