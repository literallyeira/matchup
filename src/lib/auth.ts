import { NextAuthOptions } from 'next-auth';
import axios from 'axios';

interface GTAWCharacter {
    id: number;
    memberid: number;
    firstname: string;
    lastname: string;
}

interface GTAWUser {
    id: number;
    username: string;
    confirmed: number;
    character: GTAWCharacter[];
}

interface GTAWProfile {
    user: GTAWUser;
}

export const authOptions: NextAuthOptions = {
    providers: [
        {
            id: 'gtaw',
            name: 'GTA World',
            type: 'oauth',
            authorization: {
                url: 'https://ucp-tr.gta.world/oauth/authorize',
                params: {
                    client_id: process.env.GTAW_CLIENT_ID,
                    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/gtaw`,
                    response_type: 'code',
                    scope: '',
                },
            },
            token: {
                url: 'https://ucp-tr.gta.world/oauth/token',
                async request({ params, provider }) {
                    const response = await axios.post(
                        'https://ucp-tr.gta.world/oauth/token',
                        new URLSearchParams({
                            grant_type: 'authorization_code',
                            client_id: process.env.GTAW_CLIENT_ID!,
                            client_secret: process.env.GTAW_CLIENT_SECRET!,
                            redirect_uri: provider.callbackUrl,
                            code: params.code!,
                        }).toString(),
                        {
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                        }
                    );
                    return { tokens: response.data };
                },
            },
            userinfo: {
                url: 'https://ucp-tr.gta.world/api/user',
                async request({ tokens }) {
                    const response = await axios.get(
                        'https://ucp-tr.gta.world/api/user',
                        {
                            headers: {
                                Authorization: `Bearer ${tokens.access_token}`,
                            },
                        }
                    );
                    return response.data.user;
                },
            },
            profile(profile) {
                const user = profile as unknown as GTAWUser;
                return {
                    id: user.id.toString(),
                    name: user.username,
                    gtawId: user.id,
                    username: user.username,
                    characters: user.character,
                };
            },
            clientId: process.env.GTAW_CLIENT_ID,
            clientSecret: process.env.GTAW_CLIENT_SECRET,
        },
    ],
    callbacks: {
        async jwt({ token, user, account }) {
            if (user) {
                token.gtawId = (user as any).gtawId;
                token.username = (user as any).username;
                token.characters = (user as any).characters;
            }
            if (account) {
                token.accessToken = account.access_token;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).gtawId = token.gtawId;
                (session.user as any).username = token.username;
                (session.user as any).characters = token.characters;
                (session.user as any).accessToken = token.accessToken;
            }
            return session;
        },
    },
    pages: {
        signIn: '/',
        error: '/',
    },
    session: {
        strategy: 'jwt',
    },
    secret: process.env.NEXTAUTH_SECRET,
};
