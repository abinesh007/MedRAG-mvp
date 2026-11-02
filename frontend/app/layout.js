import './globals.css';

export const metadata = {
  title: 'Medical Food Assistant',
  description: 'Ask food questions based on your prescription',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}