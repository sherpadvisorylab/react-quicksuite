import React, {useEffect, useState} from "react";
import {getAuth, GoogleAuthProvider, signInWithCredential, getAdditionalUserInfo, signOut} from 'firebase/auth';
import {Dropdown, DropdownButton, DropdownLink} from "../../components/Dropdown";
import {useTenants, useMenu} from "../../App";
import {decodeJWT, loadScripts} from "../../libs/utils";
import {useTheme} from "../../Theme";
import {useGlobalVars} from "../../Global";
import {authConfig} from "./auth";

const imgNoAvatar = "/assets/images/noavatar.svg";


const loadScript = () => {
    loadScripts([
            {src: "https://accounts.google.com/gsi/client", async: true, clean: true}
    ]);
}

const ProfileItem = ({ label, icon = null, pre= null, post= null }: {label?: string, icon?: string, pre?: string, post?: string}) => {
    const theme = useTheme("button");

    return (
        <>
            {pre}
            {icon && <i className={`${theme.getIcon(icon)}`}/>}
            {label}
            {post}
        </>
    );
};



const GoogleAuth = ({scope, iconLogout}: {scope: string, iconLogout: string}) => {
    const [tenants, setTenants] = useState([]);
    const menuAuth = useMenu("profile");
    const [ user, setUser, removeUser ] = useGlobalVars("user");
    const userProfile = user?.profile || {};

    const config = authConfig("oAuth2");

    useTenants(setTenants);

    const firebaseSignInWithGoogleCredential = async(credentialToken: string) => {
        try {
            const credential = GoogleAuthProvider.credential(credentialToken);
            const userCredential = await signInWithCredential(getAuth(), credential);
            const additionalUserInfo = getAdditionalUserInfo(userCredential);

            setUser({
                ...userCredential.user,
                profile: additionalUserInfo.profile
            });
        } catch (error) {
            console.error(error);
        }
    }
    const handleGoogleSignOut = async () => {
        window.google.accounts.id.revoke(user.profile.sub);
        localStorage.removeItem("googleCredentialToken");

        removeUser();
        const auth = getAuth();

        await signOut(auth);
        console.log("Utente disconnesso da Firebase.");

        loadScript();
    }
    window.handleGoogleSignIn = ({credential}: {credential: string}) => {
        const credentialDecoded = decodeJWT(credential);

        console.log(credential, credentialDecoded)
        localStorage.setItem("googleCredentialToken", credential);

        firebaseSignInWithGoogleCredential(credential);

        const gclient = window.google.accounts.oauth2.initTokenClient({
            client_id: config.clientId,
            scope: scope,
            callback: (tokenResponse) => {
                console.log(tokenResponse);

                localStorage.setItem('googleAccessToken', tokenResponse.access_token);
                localStorage.setItem('googleExpiresAt', new Date(new Date().getTime() + tokenResponse.expires_in * 1000));

                /*if (tokenResponse && tokenResponse.access_token) {
                    if (window.google.accounts.oauth2.hasGrantedAllScopes(tokenResponse,
                        'https://www.googleapis.com/auth/calendar.readonly',
                        'https://www.googleapis.com/auth/documents.readonly')) {
                        // Meeting planning and review documents

                    }
                }*/
            },
        });

        if (!localStorage.getItem('googleAccessToken') || new Date(localStorage.getItem('googleExpiresAt')) < new Date()) {
            // get access token
             //gclient.requestAccessToken();
        }
    };

    if(config.clientId && !window.google) {
        loadScript();
    }

    return (
        <>
            {!user && config.clientId && <div id="g_id_onload"
                                 data-client_id={config.clientId}
                                 data-context="signin"
                                 data-ux_mode="popup"
                                 data-callback="handleGoogleSignIn"
                                 data-auto_select="true"
                                 data-itp_support="true">
            </div>}



            { <div className="menu-item dropdown dropdown-mobile-full">
                <DropdownButton>
                    <div className="menu-img online">
                        <img
                            key={userProfile.picture || imgNoAvatar}
                            src={userProfile.picture || imgNoAvatar}
                            alt="Profile"
                            height="36"
                            className="avatar rounded-circle ms-2"
                            title={userProfile.name || ""}
                        />
                    </div>
                </DropdownButton>
                <Dropdown className="me-lg-3">
                    {!user && <div>
                        <DropdownLink key={"g_id_signin"}>
                            <div className="g_id_signin"
                                 data-type="standard"
                                 data-shape="pill"
                                 data-theme="filled_white"
                                 data-text="signin"
                                 data-size="large"
                                 data-logo_alignment="left">
                            </div>
                        </DropdownLink>
                        <div className="dropdown-divider"/>
                    </div>}
                    {tenants.length > 0 && <>
                        <div className="dropdown-header">Projects</div>
                        {tenants.map((item) => {
                            return (
                                <DropdownLink key={item.title} url={item.path}>
                                    <ProfileItem label={item.title} icon={item.icon} />
                                </DropdownLink>
                            );
                        })}
                        <div className="dropdown-divider" />
                    </>}
                    {menuAuth.map((item) => {
                        return (item.path
                                ? <DropdownLink key={item.title} url={item.path}>
                                    <ProfileItem label={item.title} icon={item.icon}/>
                                </DropdownLink>
                                : (!item.title || item.title === '---'
                                        ? <hr key={"---"} />
                                        : <div key={item.title} className="dropdown-header">{item.title}</div>
                                )
                        );
                    })}

                    {user && <div>
                        <div className="dropdown-divider" />
                        <DropdownLink onClick={handleGoogleSignOut}>
                            <ProfileItem label={"LOGOUT"} icon={iconLogout}/>
                        </DropdownLink>
                    </div>}
                </Dropdown>
            </div>}
        </>
    );
}


export const googleGetAccessToken = () => {
    const config = authConfig("oAuth2");

    return new Promise((resolve, reject) => {
        // Recupera il token e la data di scadenza da localStorage
        const accessToken = localStorage.getItem('googleAccessToken');
        const expiresAt = localStorage.getItem('googleExpiresAt');

        // Verifica se il token è ancora valido
        if (accessToken && expiresAt && new Date(expiresAt) > new Date()) {
            // Token esistente e valido, restituiscilo
            resolve(accessToken);
        } else {
            // Inizializza il client OAuth
            const gclient = window.google.accounts.oauth2.initTokenClient({
                client_id: config.clientId,
                scope: 'https://www.googleapis.com/auth/gmail.send',  // Inserisci gli scope necessari
                callback: (tokenResponse) => {
                    if (tokenResponse.access_token) {
                        // Salva il nuovo access token e la data di scadenza in localStorage
                        localStorage.setItem('googleAccessToken', tokenResponse.access_token);
                        localStorage.setItem('googleExpiresAt', new Date(new Date().getTime() + tokenResponse.expires_in * 1000).toISOString());

                        // Restituisci il nuovo access token
                        resolve(tokenResponse.access_token);
                    } else {
                        reject('Failed to obtain access token');
                    }
                },
            });

            // Richiede il nuovo access token
            gclient.requestAccessToken();
        }
    });
};

export default GoogleAuth;
