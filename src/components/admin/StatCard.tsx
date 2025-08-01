import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowTrendUp,
  faArrowTrendDown,
} from "@fortawesome/free-solid-svg-icons";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  index: number;
}

export default function StatCard({
  title,
  value,
  change,
  isPositive,
  index,
}: StatCardProps) {
  const isOdd = index % 2 === 1;

  const gradientBackground =
    "linear-gradient(180deg, #2b2b2b 0%, #3f3f3f 50%, #2b2b2b 80%, #5a5a5a 100%)";


  //lets make it more dark
  const darkBackground = "linear-gradient(180deg, #1a1a1a 0%, #2c2c2c 100%)";


  return (
    <div
      className="w-[272px] h-[120px] p-6 text-white transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer rounded-2xl border-gray-700"
      style={{ background: isOdd ? gradientBackground : darkBackground }}
    >
      <div className="flex flex-col h-full">
        {/* Top row */}
        <div className="flex justify-between items-start">
          {/* Title - top left */}
          <p className="text-gray-300 text-xs font-semibold font-poppins uppercase tracking-wide">
            {title}
          </p>

          {/* Arrow icon with circle background */}
          {change && (
            <div
              className="w-8 h-8 rounded-full flex items-center border border-gray-700 justify-center"
            >
              <FontAwesomeIcon
                icon={isPositive ? faArrowTrendUp : faArrowTrendDown}
                className="w-5 h-5 text-white"
              />
            </div>
          )}
        </div>

        {/* Bottom row */}
        <div className="flex justify-between items-end mt-auto">
          {/* Value - bottom left */}
          <p className="text-2xl font-bold font-poppins text-white">
            {value}
          </p>
          {/* Percentage - bottom right */}
          {change && (
            <p className="text-xs font-semibold font-poppins text-gray-300">
              {change}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
