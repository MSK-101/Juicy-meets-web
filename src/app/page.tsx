import Image from "next/image";
import Link from "next/link";
import LoginSignupDialog from "../components/registration/LoginSignupDialog";
import ImageSlider from "../components/ui/ImageSlider";

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
          <LoginSignupDialog />
        </div>
      </header>

      {/* Counter for mobile */}
      <div className="text-base font-medium text-center my-12 lg:hidden">
        3,435,789 Online Video Chatters
      </div>

      <ImageSlider imageCount={4} basePath="/home/hero_img_" />

      <div className="flex flex-col items-center text-center px-5 mt-4 lg:mt-6">
        <button
          className="py-6 px-12 rounded-full font-bold text-base md:text-xl my-6 cursor-pointer duration-300 hover:scale-105"
          style={{
            background:
              "linear-gradient(90deg, #a91dfd 0%, #b231f5 25%, #a91dfd 50%, #c66cf3 85%, #de48ff 100%)",
            border: "1px solid #e02fff",
            boxShadow:
              "inset 0px 0px 0px 0px rgba(0, 255, 0, 0.3), inset 0px 0px 20px 2px #e426ff, 0 0 200px #df42ff",
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
