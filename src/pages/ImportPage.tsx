/* Full-page "start an import" flow: its own route, under the usual header. */
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import ImportWizard, { type ImportSource } from '../components/ai/ImportWizard';

export default function ImportPage() {
  const { agent = 'trader' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const loc = useLocation();
  const state = loc.state as { files?: string[]; containers?: string[]; bl?: string } | null;
  const src = params.get('source');
  const source: ImportSource = src === 'containers' || src === 'do' || src === 'documents' ? src : 'start';
  const startAt = params.get('start') === 'journey' ? 'journey' : undefined;
  const home = () => navigate(`/landing/${agent}`);
  return (
    <div className="min-h-screen" style={{ background: '#f6f8fc' }}>
      <Header onServiceCatalogue={home} />
      <ImportWizard key={`${source}-${startAt ?? ''}-${loc.key}`} source={source} startAt={startAt} files={state?.files} containers={state?.containers} bl={state?.bl} onExit={home} />
    </div>
  );
}
