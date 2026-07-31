export const formatPeso = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

export const formatReferenceNo = (value: string, method?: string): string => {
    if (method === 'gcash') {
        const digits = value.replace(/\D/g, '').slice(0, 13);
        let formatted = '';
        for (let i = 0; i < digits.length; i++) {
            formatted += digits[i];
            if ((i === 3 || i === 6 || i === 9) && i !== digits.length - 1) {
                formatted += '-';
            }
        }
        return formatted;
    }
    if (method === 'maya') {
        const chars = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12);
        let formatted = '';
        for (let i = 0; i < chars.length; i++) {
            formatted += chars[i];
            if ((i === 3 || i === 7) && i !== chars.length - 1) {
                formatted += '-';
            }
        }
        return formatted;
    }
    return value;
};
