export const publicDemo = import.meta.env.MODE === 'pages';
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
