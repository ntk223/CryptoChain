import { CheckCircle, CircleAlert, Info } from "lucide-react";

export default function Alert({ type = 'info', children }) {
  const icons = { success: <CheckCircle/>, error: <CircleAlert/>, info: <Info/> };
  return (
    <div className={`alert alert-${type}`}>
      <span>{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}
