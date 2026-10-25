// Development-only fixture. Never imported by the application or production build.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LocaleProvider } from '../src/i18n/LocaleContext.jsx';
import VideoLibrary from '../src/components/ui/VideoLibrary.jsx';
import '../src/styles/tokens.css';
import '../src/styles/global.css';
import '../src/styles/gallery.css';
const videos = Array.from({ length: 25 }, (_, index) => ({ id: `fixture-${index}`, title: `סרטון בדיקה ${index + 1}` }));
createRoot(document.getElementById('root')).render(<BrowserRouter><LocaleProvider><main className="container"><VideoLibrary videos={videos} /></main></LocaleProvider></BrowserRouter>);
