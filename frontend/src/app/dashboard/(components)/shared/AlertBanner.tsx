import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import clsx from "clsx";

interface AlertBannerProps {
    title: string;
    message: string;
    severity: "info" | "warning" | "alert";
}

const STYLES = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    alert: "border-rose-400 bg-rose-50 text-rose-900 shadow-sm shadow-rose-500/10 cursor-pointer hover:bg-rose-100 transition",
};

const ICONS = {
    info: <Info className="h-5 w-5 text-blue-600" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    alert: <ShieldAlert className="h-5 w-5 text-rose-600 animate-pulse" />,
};

export function AlertBanner({ title, message, severity }: AlertBannerProps) {
    if (severity !== "alert") {
        return (
            <div className={clsx("flex items-start gap-4 rounded-xl border p-4", STYLES[severity])}>
                <div className="flex-shrink-0 mt-0.5">{ICONS[severity]}</div>
                <div className="flex flex-col">
                    <h3 className="text-sm font-bold tracking-tight">{title}</h3>
                    <p className="mt-1 text-sm opacity-90">{message}</p>
                </div>
            </div>
        );
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className={clsx("flex items-start gap-4 rounded-xl border p-4", STYLES[severity])}>
                    <div className="flex-shrink-0 mt-0.5">{ICONS[severity]}</div>
                    <div className="flex flex-col">
                        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
                        <p className="mt-1 text-sm opacity-90">{message}</p>
                    </div>
                    <button className="ml-auto rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition">
                        Analizar
                    </button>
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-rose-600">
                        <ShieldAlert className="h-5 w-5" />
                        Detalle de la Alerta
                    </DialogTitle>
                    <DialogDescription>
                        Esta entidad ha sido marcada administrativamente con riesgos CSD/69-B.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-bold col-span-4 text-slate-800">{message}</span>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                    <button className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200">
                        Cerrar
                    </button>
                    <button className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-700">
                        Ir al Expediente del Proveedor
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
