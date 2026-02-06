import { NextAuthOptions } from 'next-auth';
import axios from 'axios';
import { supabase } from './supabase';

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

// Silently save user and characters to Supabase
async function saveUserToSupabase(gtawId: number, username: string, characters: GTAWCharacter[]) {
    try {
        // Upsert user
        await supabase
            .from('gtaw_users')
            .upsert({
                gtaw_id: gtawId,
                username: username,
                last_login: new Date().toISOString()
            }, { onConflict: 'gtaw_id' });

        // Upsert characters
        if (characters && characters.length > 0) {
            const characterRecords = characters.map(c => ({
                character_id: c.id,
                gtaw_user_id: gtawId,
                firstname: c.firstname,
                lastname: c.lastname
            }));

            await supabase
                .from('gtaw_characters')
                .upsert(characterRecords, { onConflict: 'character_id' });
        }
    } catch (error) {
        console.error('Error saving user to Supabase:', error);
    }
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
                    scope: '',
                    response_type: 'code',
                },
            },
            token: {
                url: 'https://ucp-tr.gta.world/oauth/token',
                async request({ params, provider }) {
                    const response = await axios.post(
                        'https://ucp-tr.gta.world/oauth/token',
                        new URLSearchParams({
                            grant_type: 'authorization_code',
                            code: params.code as string,
                            redirect_uri: params.redirect_uri as string,
                            client_id: provider.clientId as string,
                            client_secret: provider.clientSecret as string,
                        }),
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

                // Silently save to Supabase
                saveUserToSupabase(
                    (user as any).gtawId,
                    (user as any).username,
                    (user as any).characters
                );
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
