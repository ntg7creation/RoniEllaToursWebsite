// Add videos here in display order. The YouTube ID is the unique record key.
// The homepage feature is selected independently so new videos cannot replace it.
export const featuredVideoId = '0ig45aOXt7A';
export const videos = [
  { id: '0ig45aOXt7A', title: 'נעים להכיר — טיולי העולם העתיק' },
  { id: 'HzPYX1855iI', title: 'האגורה והסטואה ביוון — ד״ר אייל מירון' },
  { id: 'Y-8ohoiLqi8', title: 'חלמתם אי פעם חלום? — ד״ר אייל מירון' },
  { id: 'ycCzjPy0YjU', title: 'טיול ליוון — ד״ר אייל מירון ורוני אלה' },
  { id: 'E_u9obIm2C0', title: 'טיולי העולם העתיק — ד״ר אייל מירון ורוני אלה' },
  { id: 'NH1I8RyFUQk', title: 'טיולים למצרים — ד״ר אייל מירון ורוני אלה' },
  { id: 'RQ_T1GuyMq0', title: 'טיולי עומק למצרים — ד״ר אייל מירון' },
];

export const companyVideo = videos.find(video => video.id === featuredVideoId);
