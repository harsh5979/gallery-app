
import { getSession } from '@/lib/auth';
import SmartNavbar from './SmartNavbar';

export default async function Navbar() {
    const session = await getSession();
    return <SmartNavbar session={session} />;
}
