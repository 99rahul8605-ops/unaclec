
import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "Lecture Manager",
  description: "Your lecture library inside Telegram",
  applicationName: "Lecture Manager"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
